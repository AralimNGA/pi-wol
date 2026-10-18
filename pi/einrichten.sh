#!/bin/bash
# Laeuft beim ersten Start als root (cloud-init runcmd). Kann jederzeit erneut laufen:
#   sudo bash /boot/firmware/pi-wol/einrichten.sh
set -u
QUELLE="$(cd "$(dirname "$0")" && pwd)"
LOG=/var/log/pi-wol-einrichten.log
exec > >(tee -a "$LOG") 2>&1
echo "=== pi-wol einrichten $(date)"

install -m 755 "$QUELLE/pc-wecken" /usr/local/bin/pc-wecken
install -m 755 "$QUELLE/pc-wecken-web" /usr/local/bin/pc-wecken-web
rm -rf /usr/local/share/pc-wecken/web && install -d /usr/local/share/pc-wecken && cp -r "$QUELLE/web" /usr/local/share/pc-wecken/web && chmod -R a+rX /usr/local/share/pc-wecken
install -d -m 755 /etc/pc-wecken
# Geraeteliste nur beim ersten Mal kopieren, spaetere Aenderungen auf dem Pi bleiben erhalten.
# Eigene Liste: pi/geraete.json (nicht im Repo); sonst die Vorlage mit Platzhaltern.
if [ ! -f /etc/pc-wecken/geraete.json ]; then
  if [ -f "$QUELLE/geraete.json" ]; then
    install -m 644 "$QUELLE/geraete.json" /etc/pc-wecken/geraete.json
  else
    install -m 644 "$QUELLE/geraete.example.json" /etc/pc-wecken/geraete.json
    echo "HINWEIS: Vorlage installiert, /etc/pc-wecken/geraete.json mit echten MAC-/IP-Adressen anpassen"
  fi
fi
install -m 644 "$QUELLE/pc-wecken-web.service" /etc/systemd/system/pc-wecken-web.service

# SSH-Schluessel des Pi (zum Herunterfahren der Geraete)
if [ ! -f /home/admin/.ssh/id_ed25519 ]; then
  sudo -u admin mkdir -p /home/admin/.ssh
  sudo -u admin ssh-keygen -q -t ed25519 -N "" -C "pi-wol" -f /home/admin/.ssh/id_ed25519
fi

systemctl daemon-reload
systemctl enable --now ssh
systemctl enable --now pc-wecken-web

# Ab hier braucht es Internet: bis zu 10 Minuten warten
for i in $(seq 1 60); do
  if curl -fsS --max-time 5 -o /dev/null https://pkgs.tailscale.com; then break; fi
  echo "warte auf Internet ($i)"; sleep 10
done

for i in 1 2 3; do
  apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y iputils-arping avahi-daemon && break
  sleep 15
done

if ! command -v tailscale >/dev/null; then
  for i in 1 2 3; do
    curl -fsSL --max-time 120 https://tailscale.com/install.sh | sh && break
    sleep 15
  done
fi
systemctl enable --now tailscaled 2>/dev/null
systemctl restart pc-wecken-web
echo "=== fertig $(date). Tailscale anmelden: sudo tailscale up"
