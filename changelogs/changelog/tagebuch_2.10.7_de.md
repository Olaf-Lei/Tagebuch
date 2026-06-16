# Tagebuch v2.10.7

## Bugfix

- **Kategorien und Tags bleiben nach Sync**: Neu angelegte Kategorien oder Tags, die zuvor unter demselben Namen existiert und gelöscht worden waren, verschwanden nach dem ersten Sync wieder. Der Timestamp der Neuanlage wird jetzt beim Merge gegen den Lösch-Timestamp abgewogen — „neu anlegen" gewinnt über einen älteren Tombstone.
