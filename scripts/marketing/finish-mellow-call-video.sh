#!/bin/sh
# usage: finish-mellow-call-video.sh <clip1.mp4> <clip2.mp4> <out.mp4> [headline line 1] [headline line 2]
# Default headline: 조금 서툴러도, / 대화는 계속.
# Needs ffmpeg and Google Chrome. Renders the end card, gradient and call toast PNGs on first run.
# clip1: brand cover (0-0.8 s) + gradient + incoming-call toast (0.5-2.3 s, pulsing, with chime) + headline from 3.0 s; clip2: headline (+ dialogue subtitles when DIALOGUE=1); then 2 s end card.
set -e
C1="$1"; C2="$2"; OUT="$3"; D=$(cd "$(dirname "$0")" && pwd); S="$D/mellow-call-sub"
H1="$S/h1.txt"; H2="$S/h2.txt"
if [ -n "$4" ]; then H1=$(mktemp); printf '%s' "$4" > "$H1"; fi
if [ -n "$5" ]; then H2=$(mktemp); printf '%s' "$5" > "$H2"; fi
FONT=/System/Library/Fonts/AppleSDGothicNeo.ttc
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
LOGO_LIGHT=/Users/eun/projects/eun/mellow/assets/brand/logo-light.svg
render() { "$CHROME" --headless=new --hide-scrollbars --disable-gpu --default-background-color=00000000 --window-size=1080,1920 --screenshot="$2" "file://$1" >/dev/null 2>&1; }
[ -f "$D/endcard.png" ] || render "$D/mellow-endcard.html" "$D/endcard.png"
[ -f "$D/shade.png" ] || render "$D/mellow-shade.html" "$D/shade.png"
if [ ! -f "$D/chime.wav" ]; then # soft two-note notification chime (C6 -> E6), synthesized, no external asset
  ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=1046.5:duration=0.6" -f lavfi -i "sine=frequency=1318.5:duration=0.9" \
   -filter_complex "[0:a]volume='0.5*exp(-7*t)':eval=frame,aformat=channel_layouts=stereo[n1];[1:a]adelay=130|130,volume='0.55*exp(-5*t)':eval=frame,aformat=channel_layouts=stereo[n2];[n1][n2]amix=inputs=2:normalize=0,aecho=0.6:0.25:120:0.18,highpass=f=400,aresample=48000,volume=30dB,alimiter=limit=0.6[c]" -map "[c]" -t 1.2 "$D/chime.wav"
fi
LOGO=$(cat "$LOGO_LIGHT")
COVER=$(mktemp -t mellow-cover).png; BASE=$(cat "$D/mellow-cover.html"); BASE="${BASE//LOGO/$LOGO}"; BASE="${BASE//LINE1/$(cat "$H1")}"; BASE="${BASE//LINE2/$(cat "$H2")}"; printf '%s' "$BASE" > "$COVER.html"; render "$COVER.html" "$COVER"; rm -f "$COVER.html"
if [ ! -f "$D/watermark.png" ]; then BASE=$(cat "$D/mellow-watermark.html"); printf '%s' "${BASE//LOGO/$LOGO}" > "$D/.wm.html"; render "$D/.wm.html" "$D/watermark.png"; rm -f "$D/.wm.html"; fi
if [ ! -f "$D/callcard-a.png" ]; then
  LOGO=$(cat "$LOGO_LIGHT"); BASE=$(cat "$D/mellow-callcard.html")
  printf '%s' "${BASE//LOGO/$LOGO}" | sed 's/ICONCLASS//' > "$D/.callcard-a.html"; render "$D/.callcard-a.html" "$D/callcard-a.png"
  printf '%s' "${BASE//LOGO/$LOGO}" | sed 's/ICONCLASS/ring/' > "$D/.callcard-b.html"; render "$D/.callcard-b.html" "$D/callcard-b.png"; rm -f "$D/.callcard-a.html" "$D/.callcard-b.html"
fi
head() { echo "drawtext=fontfile=$FONT:textfile=$H1:fontcolor=white:fontsize=88:x=72:y=150:enable='$1',drawtext=fontfile=$FONT:textfile=$H2:fontcolor=0xc6ed82:fontsize=88:x=72:y=262:enable='$1'"; }
sub() { # $1 name $2 en $3 ko $4 start $5 end
  echo "drawtext=fontfile=$FONT:textfile=$S/$1:fontcolor=0xc6ed82:fontsize=34:x=72:y=1500:enable='between(t,$4,$5)',drawtext=fontfile=$FONT:textfile=$S/$2:fontcolor=white:fontsize=50:x=72:y=1548:enable='between(t,$4,$5)',drawtext=fontfile=$FONT:textfile=$S/$3:fontcolor=white@0.72:fontsize=32:x=72:y=1624:enable='between(t,$4,$5)'"
}
if [ "${DIALOGUE:-0}" = 1 ]; then SUBS=",$(sub n1.txt e1.txt k1.txt 0.2 1.9),$(sub n2.txt e2.txt k2.txt 2.0 3.6),$(sub n3.txt e3.txt k3.txt 3.7 5.0)"; else SUBS=""; fi
ffmpeg -y -loglevel error -i "$C1" -i "$C2" -loop 1 -t 2 -i "$D/endcard.png" -f lavfi -t 2 -i anullsrc=r=48000:cl=stereo -i "$D/shade.png" -i "$D/callcard-a.png" -i "$D/callcard-b.png" -i "$D/chime.wav" -i "$D/chime.wav" -loop 1 -framerate 30 -t 1 -i "$COVER" -loop 1 -framerate 30 -t 12 -i "$D/watermark.png" \
 -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[b1];[b1][4:v]overlay=0:0:format=auto[s1];\
[s1][5:v]overlay=x=0:y='if(lt(t,0.8),-60+60*(t-0.5)/0.3,0)':enable='between(t,0.5,2.3)*lt(mod(t,0.5),0.25)':format=auto[c1];\
[c1][6:v]overlay=x=0:y=0:enable='between(t,0.5,2.3)*gte(mod(t,0.5),0.25)':format=auto[c2];\
[10:v]split[wa][wb];[c2][wa]overlay=0:0:format=auto:enable='gte(t,0.8)':shortest=1[w1];[9:v]format=rgba,fade=t=out:st=0.45:d=0.35:alpha=1[cv];[w1][cv]overlay=0:0:format=auto:enable='lt(t,0.8)':eof_action=pass[c3];[c3]$(head 'gte(t,3.0)'),format=yuv420p[v0];\
[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[b2];[b2][4:v]overlay=0:0:format=auto[s2];[s2][wb]overlay=0:0:format=auto:shortest=1,$(head 1)$SUBS,format=yuv420p[v1];\
[2:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v2];\
[7:a]adelay=500|500[ch1];[8:a]adelay=1500|1500,volume=0.8[ch2];[0:a]aformat=sample_rates=48000:channel_layouts=stereo[src];[src][ch1][ch2]amix=inputs=3:normalize=0:duration=first[a0];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a1];\
[v0][a0][v1][a1][v2][3:a]concat=n=3:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 128k -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
