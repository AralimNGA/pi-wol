# pi-wol – Startzentrale

> Raspberry Pi als Wake-on-LAN-Zentrale mit Weboberfläche und drei Start-Designs (English: [README.md](README.md)).

Raspberry Pi als Wake-on-LAN-Zentrale für den Render-PC und ein ThinkPad. Er weckt die Geräte, zeigt ihren
Status und fährt sie per SSH herunter. Die Weboberfläche hat drei umschaltbare Start-Designs und ist im LAN
und über Tailscale erreichbar.

- LAN: `http://pi-wol.local`, Tailscale: `http://pi-wol` (MagicDNS) bzw. die 100.x-IP des Pi
- SSH: `ssh admin@pi-wol.local` (Schlüssel hinterlegt, Passwort als Fallback)
- CLI auf dem Pi: `pc-wecken`, `pc-wecken an pc --warten`, `pc-wecken aus pc`, `pc-wecken status pc`
- Geräte: `/etc/pc-wecken/geraete.json` auf dem Pi. Vorlage: `pi/geraete.example.json`. Die eigene Liste liegt
  lokal in `pi/geraete.json` und ist gitignored.

## Drei Designs

Oben auf der Seite umschaltbar (der Browser merkt sich die Wahl, `?thema=lambo|cockpit|atom` erzwingt eines):

- **Supersportwagen** (`lambo`): Startknopf unter roter Klappe in einer Mittelkonsole. Klappe anheben → START.
- **Cockpit** (`cockpit`): Overhead-Panel mit rot geschütztem Kippschalter, Annunciators und N2-Anzeige.
  Schutzklappe hoch → Hebel nach oben ziehen.
- **Abschuss** (`atom`): Big Red Button unter Haube. Schlüssel auf ARM → Haube hoch → LAUNCH → Countdown 3-2-1
  (abbrechbar).

STOP immer: entsichern + 1.5 s halten. Die Entsicherung fällt nach 15 s zurück. Vertrag für Designs: `THEMEN.md`.
Demo ohne Pi: `cd pi/web && python3 -m http.server 8712`, dann `http://localhost:8712/?demo`.

## Karte neu bauen

```bash
# 1. Image holen (Raspberry Pi OS Lite arm64, Trixie, cloud-init)
curl -fL -o pios.img.xz https://downloads.raspberrypi.com/raspios_lite_arm64_latest && xz -d pios.img.xz
# 2. Karte finden und flashen; macOS fragt nach dem Admin-Passwort
diskutil list external physical
diskutil unmountDisk /dev/diskN && /usr/libexec/authopen -w /dev/rdiskN < pios.img
diskutil mount diskNs1
# 3. Konfiguration schreiben. Passwörter ohne Argument werden verdeckt abgefragt.
cp pi/geraete.example.json pi/geraete.json   # MAC-, IP- und SSH-Angaben eintragen
python3 karte_bauen.py --boot /Volumes/bootfs --ssid '<wlan>' --geraete pi/geraete.json
#    optional: --wlan-von <alte network-config>, --hostname, --dtoverlay '<Display-Overlay>'
diskutil eject /dev/diskN
```

Beim ersten Start installiert `pi/einrichten.sh` alles (Log: `/var/log/pi-wol-einrichten.log`) und holt
`iputils-arping`, `avahi-daemon` und Tailscale. Danach einmal `sudo tailscale up` ausführen und den Link öffnen.

## Geräteliste

`mac` (Netzwerkkarte, die wecken soll), `lan_ip` (Fallback), `ts_ip` (Tailscale), `broadcast` (Netz-Broadcast,
z. B. `192.168.1.255`; `255.255.255.255` wird immer mitgesendet), `ssh` (`benutzer@host` oder `null`) und
`aus_befehl` (Standard `shutdown /s /t 5`).

## Ausschalten per Knopf

Der Pi erzeugt beim ersten Start `/home/admin/.ssh/id_ed25519`. Dessen `.pub` muss auf dem Windows-Gerät in
`C:\ProgramData\ssh\administrators_authorized_keys` (Admin-Benutzer) stehen, und in `geraete.json` muss `"ssh"`
gesetzt sein. Ohne SSH bleibt STOP deaktiviert.

## WoL aus dem ausgeschalteten Zustand (S5)

- Windows: Adapter „Wake-On-Lan herunterfahren“ = Aktiviert, „Wake on Magic Packet“ = Aktiviert, Schnellstart aus.
- BIOS/UEFI: ErP aus, Wecken über PCI-E an (die Bezeichnungen hängen vom Mainboard ab).
- Das Netzteil muss Strom haben (keine ausgeschaltete Steckerleiste).
- ThinkPad: WoL meist nur über Kabel/Dock und am Netzteil (BIOS: Config → Network → Wake On LAN = AC Only).
- Tailscale auf Windows: `tailscale set --unattended`, damit der PC schon vor der Anmeldung im Tailnet ist.

## Status-Erkennung

Die Windows-Firewall blockt im Netzprofil „Öffentlich“ Ping und SSH im LAN. Darum zuerst Tailscale „Online“,
dann TCP 22/3389 über Tailscale und LAN, zuletzt ARP (`arping`). Auf ARP antwortet die Netzwerkkarte immer. Die
aktuelle LAN-IP lernt der Pi aus Tailscale (DHCP-Wechsel).

## Sicherheit

Es gibt keine Anmeldung: Wer den Pi im LAN oder im Tailnet erreicht, kann Geräte starten und stoppen. Port 80
nicht ins Internet freigeben. Der Server nimmt nur eigene Hostnamen an (Schutz gegen DNS-Rebinding). POST
braucht den Header `X-PCW: 1` und einen passenden `Origin`, damit fremde Webseiten nichts auslösen können (CSRF).

Gebaut mit KI-Agenten (Claude Code). Die ursprüngliche Fassung lief auf der echten Hardware; diese bereinigte Fassung
(Broadcast aus der Konfiguration, Header `X-PCW` und Origin-Prüfung, umgebautes `karte_bauen.py`) ist bisher nur auf
macOS getestet, noch nicht auf einem Raspberry Pi. Lizenz: MIT.
