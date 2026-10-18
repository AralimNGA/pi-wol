#!/usr/bin/env python3
"""Richtet eine frisch geflashte Raspberry-Pi-OS-Karte (Trixie, cloud-init) als WoL-Pi ein.

  python3 karte_bauen.py --boot /Volumes/bootfs --ssid '<wlan>' --geraete pi/geraete.json

Passwoerter: --passwort / --wlan-passwort weglassen, dann wird verdeckt nachgefragt
(landet nicht in der Shell-History). Nur der Hash des Benutzerpassworts kommt auf die Karte.
--wlan-von: network-config einer alten Karte; deren WLAN-Zugaenge werden uebernommen
            (das Passwort wird nur gelesen, nie ausgegeben). Alternativ --ssid/--wlan-passwort.
--geraete:  eigene Geraeteliste (Vorlage pi/geraete.example.json). Ohne sie installiert der Pi
            die Vorlage, die danach in /etc/pc-wecken/geraete.json angepasst werden muss.
Flashen selbst: siehe README.md (authopen, braucht das Admin-Passwort im macOS-Dialog).
"""
import argparse
import getpass
import json
import os
import shutil
import subprocess
import sys
import time

HIER = os.path.dirname(os.path.abspath(__file__))
BENUTZER = "admin"          # einrichten.sh und pc-wecken-web.service erwarten diesen Benutzer


def q(s):
    return json.dumps(s, ensure_ascii=False)   # JSON-String ist gueltiges YAML


def openssl_finden(wunsch=None):
    """OpenSSL mit 'passwd -6' (SHA-512-crypt). Das LibreSSL von macOS kann das nicht, darum Homebrew zuerst."""
    for kandidat in [wunsch, "/opt/homebrew/bin/openssl", "/usr/local/bin/openssl", shutil.which("openssl")]:
        if kandidat and os.path.exists(kandidat):
            return kandidat
    sys.exit("openssl nicht gefunden (macOS: brew install openssl)")


def passwort_hash(pw, openssl):
    r = subprocess.run([openssl, "passwd", "-6", "-stdin"],
                       input=pw, capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.startswith("$6$"):
        sys.exit(f"{openssl} kann 'passwd -6' nicht (OpenSSL 1.1.1+ noetig, z. B. brew install openssl)")
    return r.stdout.strip()


def wlan_aus_datei(pfad):
    import yaml
    with open(pfad, encoding="utf-8") as f:
        d = yaml.safe_load(f)
    d = d.get("network", d)
    zugaenge = {}
    for iface in (d.get("wifis") or {}).values():
        if isinstance(iface, dict):
            zugaenge.update(iface.get("access-points") or {})
    return zugaenge


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--boot", default="/Volumes/bootfs", help="gemountete Bootpartition der Karte")
    ap.add_argument("--hostname", default="pi-wol")
    ap.add_argument("--passwort", help="Passwort fuer den Benutzer admin (sonst Abfrage)")
    ap.add_argument("--wlan-von", help="network-config einer alten Karte")
    ap.add_argument("--ssid")
    ap.add_argument("--wlan-passwort", help="sonst Abfrage, wenn --ssid gesetzt ist")
    ap.add_argument("--ssh-key", default=os.path.expanduser("~/.ssh/id_ed25519.pub"))
    ap.add_argument("--geraete", help="eigene geraete.json (Standard: pi/geraete.json, falls vorhanden)")
    ap.add_argument("--land", default="CH", help="WLAN-Regulierungsdomaene")
    ap.add_argument("--zeitzone", default="Europe/Zurich")
    ap.add_argument("--tastatur", default="ch", help="Tastaturlayout der Konsole")
    ap.add_argument("--dtoverlay", help="optionales Display-Overlay fuer config.txt, "
                                        "z. B. 'vc4-kms-dsi-waveshare-panel,7_0_inchC'")
    ap.add_argument("--openssl", help="Pfad zu einem OpenSSL mit 'passwd -6'")
    a = ap.parse_args()

    boot = a.boot
    if not os.path.exists(os.path.join(boot, "cmdline.txt")):
        sys.exit(f"{boot} ist keine Pi-Bootpartition")

    geraete = a.geraete or os.path.join(HIER, "pi", "geraete.json")
    if a.geraete and not os.path.isfile(geraete):
        sys.exit(f"Geraeteliste {geraete} fehlt")
    if os.path.isfile(geraete):
        with open(geraete, encoding="utf-8") as f:
            json.load(f)                       # Syntaxfehler jetzt melden, nicht erst auf dem Pi
    else:
        geraete = None

    passwort = a.passwort or getpass.getpass(f"Passwort fuer {BENUTZER}@{a.hostname}: ")
    if not passwort:
        sys.exit("Leeres Passwort")
    zugaenge = wlan_aus_datei(a.wlan_von) if a.wlan_von else {}
    if a.ssid:
        zugaenge[a.ssid] = {"password": a.wlan_passwort if a.wlan_passwort is not None
                            else getpass.getpass(f"WLAN-Passwort fuer {a.ssid}: ")}
    with open(a.ssh_key, encoding="utf-8") as f:
        key = f.read().strip()

    # --- user-data ---
    ud = f"""#cloud-config
hostname: {a.hostname}
manage_etc_hosts: true
timezone: {a.zeitzone}
keyboard:
  model: pc105
  layout: {a.tastatur}
users:
- name: {BENUTZER}
  gecos: Admin
  groups: users,adm,dialout,audio,netdev,video,plugdev,cdrom,games,input,gpio,spi,i2c,render,sudo
  shell: /bin/bash
  lock_passwd: false
  passwd: {q(passwort_hash(passwort, openssl_finden(a.openssl)))}
  sudo: ALL=(ALL) NOPASSWD:ALL
  ssh_authorized_keys:
  - {q(key)}
ssh_pwauth: true
runcmd:
- [bash, /boot/firmware/pi-wol/einrichten.sh]
"""
    # --- network-config ---
    nc = ["network:", "  version: 2", "  renderer: NetworkManager",
          "  ethernets:", "    eth0:", "      dhcp4: true", "      optional: true"]
    if zugaenge:
        nc += ["  wifis:", "    wlan0:", "      dhcp4: true", "      optional: true",
               f"      regulatory-domain: {a.land}", "      access-points:"]
        for ssid, daten in zugaenge.items():
            nc += [f"        {q(str(ssid))}:", f"          password: {q(str((daten or {}).get('password', '')))}"]
    nc = "\n".join(nc) + "\n"

    with open(os.path.join(boot, "user-data"), "w", encoding="utf-8") as f:
        f.write(ud)
    with open(os.path.join(boot, "network-config"), "w", encoding="utf-8") as f:
        f.write(nc)
    open(os.path.join(boot, "ssh"), "w").close()
    # Neue instance_id: cloud-init richtet auch eine schon einmal gebootete Karte neu ein (WLAN, Benutzer, runcmd)
    with open(os.path.join(boot, "meta-data"), "w", encoding="utf-8") as f:
        f.write(f"dsmode: local\ninstance_id: pi-wol-{time.strftime('%Y%m%d-%H%M%S')}\n")

    # cmdline.txt: WLAN-Land (eine Zeile!)
    cp = os.path.join(boot, "cmdline.txt")
    with open(cp, encoding="utf-8") as f:
        cmd = f.read().strip()
    if "ieee80211_regdom" not in cmd:
        cmd += f" cfg80211.ieee80211_regdom={a.land}"
    with open(cp, "w", encoding="utf-8") as f:
        f.write(cmd + "\n")

    # config.txt: optionales Display-Overlay (z. B. 7"-DSI-Touchscreen)
    if a.dtoverlay:
        zeile = f"dtoverlay={a.dtoverlay}"
        cfg = os.path.join(boot, "config.txt")
        with open(cfg, encoding="utf-8") as f:
            t = f.read()
        if zeile not in t:
            with open(cfg, "w", encoding="utf-8") as f:
                f.write(t.rstrip("\n") + f"\n# Display (karte_bauen.py --dtoverlay)\n{zeile}\n")

    # Programme auf die Bootpartition, einrichten.sh installiert sie beim ersten Start
    ziel = os.path.join(boot, "pi-wol")
    shutil.rmtree(ziel, ignore_errors=True)
    shutil.copytree(os.path.join(HIER, "pi"), ziel,
                    ignore=shutil.ignore_patterns("geraete.json", "__pycache__", ".DS_Store"))
    if geraete:
        shutil.copyfile(geraete, os.path.join(ziel, "geraete.json"))

    print(f"Karte eingerichtet: Host {a.hostname}, Benutzer {BENUTZER}, "
          f"WLAN-Netze: {', '.join(zugaenge) or 'keine (nur Ethernet)'}, "
          f"Geraete: {'eigene Liste' if geraete else 'Vorlage (auf dem Pi anpassen)'}")


if __name__ == "__main__":
    main()
