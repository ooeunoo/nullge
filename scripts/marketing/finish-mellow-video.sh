#!/bin/sh
# usage: finish-mellow-video.sh <in.mp4> <line1> <line2> <out.mp4>
# 1080x1920, lime headline over a gradient for the first ~4 s, 2 s mellow end card, original audio kept.
# Needs ffmpeg and Google Chrome (renders the end card and gradient PNGs on first run).
set -e
IN="$1"; L1="$2"; L2="$3"; OUT="$4"; D=$(cd "$(dirname "$0")" && pwd)
FONT=/System/Library/Fonts/AppleSDGothicNeo.ttc
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -f "$D/endcard.png" ] || "$CHROME" --headless=new --hide-scrollbars --disable-gpu --window-size=1080,1920 --screenshot="$D/endcard.png" "file://$D/mellow-endcard.html" >/dev/null 2>&1
[ -f "$D/shade.png" ] || "$CHROME" --headless=new --hide-scrollbars --disable-gpu --default-background-color=00000000 --window-size=1080,1920 --screenshot="$D/shade.png" "file://$D/mellow-shade.html" >/dev/null 2>&1
ffmpeg -y -loglevel error -i "$IN" -loop 1 -t 2 -i "$D/endcard.png" -f lavfi -t 2 -i anullsrc=r=48000:cl=stereo -i "$D/shade.png" \
 -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1[base];[base][3:v]overlay=0:0:format=auto,\
drawtext=fontfile=$FONT:text='$L1':fontcolor=white:fontsize=88:x=72:y=150:enable='between(t,0.4,4.6)':alpha='if(lt(t,0.9),(t-0.4)/0.5,1)',\
drawtext=fontfile=$FONT:text='$L2':fontcolor=0xc6ed82:fontsize=88:x=72:y=262:enable='between(t,0.4,4.6)':alpha='if(lt(t,0.9),(t-0.4)/0.5,1)',\
fps=30,format=yuv420p[v0];[1:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v1];\
[0:a]aformat=sample_rates=48000:channel_layouts=stereo[a0];\
[v0][a0][v1][2:a]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 128k -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of default=nw=1 "$OUT"
