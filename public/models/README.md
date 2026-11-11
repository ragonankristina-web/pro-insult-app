# Модели

`rtmpose-m-wholebody.onnx` — RTMPose-m, COCO-WholeBody (133 точки: тело, стопы, лицо, кисти), вход 256×192.
Источник: OpenMMLab MMPose, файл `end2end.onnx` из
https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-m_simcc-ucoco_dw-ucoco_270e-256x192-c8b76419_20230728.zip
Лицензия Apache-2.0 (https://github.com/open-mmlab/mmpose/blob/main/LICENSE).

`ru_RU-ruslan-medium.onnx` (+ `.onnx.json`) — голос ассистента Брэйни, Piper (rhasspy), голос «ruslan», качество medium.
Источник: https://huggingface.co/rhasspy/piper-voices/tree/main/ru/ru_RU/ruslan/medium
Обучен на корпусе RUSLAN (https://ruslan-corpus.github.io/) — лицензия **CC BY-NC-SA 4.0: только некоммерческое
использование, с указанием авторства**. Перед платной версией приложения голос нужно заменить, например на
`ru_RU-dmitri-medium` или `ru_RU-denis-medium` (лицензия CC0).
