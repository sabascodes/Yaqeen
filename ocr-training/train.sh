#!/bin/bash
# Fine-tune Tesseract's best model for LANG on the generated lines. usage: train.sh ara|eng ITER
L=$1; N=$2; S=$([ $L = ara ] && echo ar || echo en)
cd /tmp/ocr && mkdir -p ft/$L
combine_tessdata -e tdbest/$L.traineddata ft/$L/base.lstm >/dev/null
lstmtraining --model_output ft/$L/m --continue_from ft/$L/base.lstm --traineddata tdbest/$L.traineddata \
  --train_listfile lines/$S.train --eval_listfile lines/$S.eval --max_iterations $N --learning_rate 0.0001 --target_error_rate 0.005
lstmtraining --stop_training --continue_from ft/$L/m_checkpoint --traineddata tdbest/$L.traineddata --model_output ft/$L/${L}_ft_best.traineddata
lstmtraining --stop_training --convert_to_int --continue_from ft/$L/m_checkpoint --traineddata tdbest/$L.traineddata --model_output ft/$L/${L}_ft_int.traineddata
echo TRAIN_DONE
