#!/bin/bash
# Downloads the Arabic and English Google Fonts used to draw training and test pictures (all OFL/Apache).
set -e
W=${OCR_WORK:-/tmp/ocr}; mkdir -p $W/fonts/ar $W/fonts/en
fetch(){ m=$(curl -sS https://raw.githubusercontent.com/google/fonts/main/$1/METADATA.pb) || return 0
  for f in $(echo "$m" | grep 'filename:' | sed 's/.*"\(.*\)".*/\1/' | grep -v Italic); do
    [ -s "$2/$f" ] || curl -gsS -o "$2/$f" "https://raw.githubusercontent.com/google/fonts/main/$1/$f"; done; }
for d in amiri amiriquran arefruqaa arefruqaaink reemkufi reemkufifun reemkufiink lateef scheherazadenew notonaskharabic \
  notokufiarabic notosansarabic notonastaliqurdu cairo cairoplay tajawal elmessiri lalezar rakkas mada harmattan katibeh \
  jomhuria mirza marhey blaka blakaink blakahollow kufam alkalami gulzar vibes qahiri ruwudu changa almarai ibmplexsansarabic \
  readexpro rubik baloobhaijaan2 markazitext lemonada vazirmatn badeendisplay handjet zain playpensansarabic beiruti fustat; do
  fetch ofl/$d $W/fonts/ar; done
for d in ofl/lobster ofl/pacifico ofl/dancingscript ofl/greatvibes ofl/playfairdisplay ofl/bebasneue ofl/abrilfatface \
  ofl/cinzel ofl/merriweather ofl/roboto ofl/opensans ofl/lato ofl/montserrat ofl/oswald ofl/raleway ofl/poppins ofl/amaticsc \
  ofl/caveat ofl/righteous ofl/cormorantgaramond ofl/lora ofl/sacramento ofl/kaushanscript ofl/courgette ofl/alfaslabone \
  ofl/bangers apache/specialelite ofl/anton ofl/comfortaa ofl/indieflower; do fetch $d $W/fonts/en; done
ls $W/fonts/ar | wc -l; ls $W/fonts/en | wc -l
