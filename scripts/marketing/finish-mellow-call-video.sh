#!/bin/sh
# usage: finish-mellow-call-video.sh <clip1.mp4> <clip2.mp4> <out.mp4>
# Needs ffmpeg and Google Chrome. Renders the end card, gradient and call toast PNGs on first run.
# clip1: gradient + incoming-call toast (0.5-2.3 s, pulsing) + headline from 3.0 s; clip2: headline + dialogue subtitles; then 2 s end card.
set -e
C1="$1"; C2="$2"; OUT="$3"; D=$(cd "$(dirname "$0")" && pwd); S="$D/mellow-call-sub"
FONT=/System/Library/Fonts/AppleSDGothicNeo.ttc
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
LOGO_LIGHT=/Users/eun/projects/eun/mellow/assets/brand/logo-light.svg
render() { "$CHROME" --headless=new --hide-scrollbars --disable-gpu --default-background-color=00000000 --window-size=1080,1920 --screenshot="$2" "file://$1" >/dev/null 2>&1; }
[ -f "$D/endcard.png" ] || render "$D/mellow-endcard.html" "$D/endcard.png"
[ -f "$D/shade.png" ] || render "$D/mellow-shade.html" "$D/shade.png"
if [ ! -f "$D/callcard-a.png" ]; then
  LOGO=$(cat "$LOGO_LIGHT"); BASE=$(cat "$D/mellow-callcard.html")
  printf '%s' "${BASE//LOGO/$LOGO}" | sed 's/ICONCLASS//' > "$D/.callcard-a.html"; render "$D/.callcard-a.html" "$D/callcard-a.png"
  printf '%s' "${BASE//LOGO/$LOGO}" | sed 's/ICONCLASS/ring/' > "$D/.callcard-b.html"; render "$D/.callcard-b.html" "$D/callcard-b.png"; rm -f "$D/.callcard-a.html" "$D/.callcard-b.html"
fi
head() { echo "drawtext=fontfile=$FONT:textfile=$S/h1.txt:fontcolor=white:fontsize=88:x=72:y=150:enable='$1',drawtext=fontfile=$FONT:textfile=$S/h2.txt:fontcolor=0xc6ed82:fontsize=88:x=72:y=262:enable='$1'"; }
sub() { # $1 name $2 en $3 ko $4 start $5 end
  echo "drawtext=fontfile=$FONT:textfile=$S/$1:fontcolor=0xc6ed82:fontsize=34:x=72:y=1500:enable='between(t,$4,$5)',drawtext=fontfile=$FONT:textfile=$S/$2:fontcolor=white:fontsize=50:x=72:y=1548:enable='between(t,$4,$5)',drawtext=fontfile=$FONT:textfile=$S/$3:fontcolor=white@0.72:fontsize=32:x=72:y=1624:enable='between(t,$4,$5)'"
}
SUBS="$(sub n1.txt e1.txt k1.txt 0.2 1.9),$(sub n2.txt e2.txt k2.txt 2.0 3.6),$(sub n3.txt e3.txt k3.txt 3.7 5.0)"
ffmpeg -y -loglevel error -i "$C1" -i "$C2" -loop 1 -t 2 -i "$D/endcard.png" -f lavfi -t 2 -i anullsrc=r=48000:cl=stereo -i "$D/shade.png" -i "$D/callcard-a.png" -i "$D/callcard-b.png" \
 -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[b1];[b1][4:v]overlay=0:0:format=auto[s1];\
[s1][5:v]overlay=x=0:y='if(lt(t,0.8),-60+60*(t-0.5)/0.3,0)':enable='between(t,0.5,2.3)*lt(mod(t,0.5),0.25)':format=auto[c1];\
[c1][6:v]overlay=x=0:y=0:enable='between(t,0.5,2.3)*gte(mod(t,0.5),0.25)':format=auto[c2];\
[c2]$(head 'gte(t,3.0)'),format=yuv420p[v0];\
[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[b2];[b2][4:v]overlay=0:0:format=auto,$(head 1),$SUBS,format=yuv420p[v1];\
[2:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v2];\
[0:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];[1:a]aformat=sample_rates=48000:channel_layouts=stereo[a1];\
[v0][a0][v1][a1][v2][3:a]concat=n=3:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 128k -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
