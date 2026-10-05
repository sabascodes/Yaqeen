#!/bin/bash
# Generate training lines and convert them to Tesseract training files (.lstmf).
set -e
cd /tmp/ocr
python3 make_lines.py ar 30000 lines/ar 11
python3 make_lines.py en 12000 lines/en 12
for L in ar en; do
  T=$([ $L = ar ] && echo ara || echo eng)
  ls lines/$L/*.png | sed 's/\.png$//' | xargs -P 4 -I{} sh -c "[ -f {}.lstmf ] || tesseract {}.png {} --psm 13 -l $T --tessdata-dir /tmp/ocr/tdbest lstm.train >/dev/null 2>&1"
  ls lines/$L/*.lstmf | shuf --random-source=<(yes) > lines/$L.all
  head -n 1000 lines/$L.all > lines/$L.eval; tail -n +1001 lines/$L.all > lines/$L.train
  wc -l lines/$L.train
done
echo LINES_DONE
