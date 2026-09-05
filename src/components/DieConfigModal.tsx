import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { DieInstanceConfig, DieType, DIE_TYPES, DIE_SIDES, IconType, ICON_TYPES, FaceStyle } from '../dice/types';

const DIE_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#212121', '#ffffff'];

const ICON_LABELS: Record<IconType, string> = {
  skull: 'Calavera',
  fire: 'Fuego',
  water: 'Agua',
  earth: 'Tierra',
  light: 'Luz',
  dark: 'Oscuridad',
  cat: 'Gato',
  dog: 'Perro',
  bird: 'Ave',
  fish: 'Pez',
};

// Short labels for the compact per-face slots (full names would overflow a 48px tile).
const ICON_SHORT: Record<IconType, string> = {
  skull: 'CAL',
  fire: 'FUE',
  water: 'AGU',
  earth: 'TIE',
  light: 'LUZ',
  dark: 'OSC',
  cat: 'GAT',
  dog: 'PER',
  bird: 'AVE',
  fish: 'PEZ',
};

interface DieConfigModalProps {
  die: DieInstanceConfig | null;
  onChangeType: (type: DieType) => void;
  onChangeColor: (color: string) => void;
  onChangeFaceStyle: (style: FaceStyle) => void;
  onChangeName: (name: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export { DIE_COLORS };

export function DieConfigModal({
  die,
  onChangeType,
  onChangeColor,
  onChangeFaceStyle,
  onChangeName,
  onRemove,
  onClose,
}: DieConfigModalProps) {
  // vh/vw-equivalent: recomputes on rotation/resize, unlike a Dimensions.get() snapshot.
  const { width: vw, height: vh } = useWindowDimensions();
  const hasFaces = die?.type !== 'd100';
  const faceCount = die ? DIE_SIDES[die.type] : 0;
  const photoModeAllowed = faceCount > 0 && faceCount <= 10;
  // Classic dot layouts only exist for 1-6 — no canonical pip pattern past a d6.
  const pipsAllowed = faceCount > 0 && faceCount <= 6;
  const isDrawing = die?.faceStyle.kind === 'icon' || die?.faceStyle.kind === 'photo';

  // Which face slot is currently being edited in per-face icon mode.
  const [selectedFace, setSelectedFace] = useState(0);
  useEffect(() => {
    setSelectedFace(0);
  }, [die?.id]);
  useEffect(() => {
    setSelectedFace((f) => Math.min(f, Math.max(faceCount - 1, 0)));
  }, [faceCount]);

  const enableDrawingMode = () => {
    if (!die || isDrawing) return;
    onChangeFaceStyle({ kind: 'icon', icons: new Array(faceCount).fill('skull') });
  };

  const enableIconMode = () => {
    if (!die || die.faceStyle.kind === 'icon') return;
    onChangeFaceStyle({ kind: 'icon', icons: new Array(faceCount).fill('skull') });
  };

  const setFaceIcon = (index: number, icon: IconType | null) => {
    if (!die || die.faceStyle.kind !== 'icon') return;
    const next = [...die.faceStyle.icons];
    next[index] = icon;
    onChangeFaceStyle({ kind: 'icon', icons: next });
  };

  const fillAllIcons = (icon: IconType) => {
    if (!die) return;
    onChangeFaceStyle({ kind: 'icon', icons: new Array(faceCount).fill(icon) });
  };

  const enablePhotoMode = () => {
    if (!die || !photoModeAllowed || die.faceStyle.kind === 'photo') return;
    onChangeFaceStyle({ kind: 'photo', uris: new Array(faceCount).fill(null) });
  };

  const pickPhotoForFace = async (index: number) => {
    if (!die) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para personalizar el dado.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      const current = die.faceStyle.kind === 'photo' ? die.faceStyle.uris : new Array(DIE_SIDES[die.type]).fill(null);
      const next = [...current];
      next[index] = result.assets[0].uri;
      onChangeFaceStyle({ kind: 'photo', uris: next });
    }
  };

  const clearFacePhoto = (index: number) => {
    if (!die || die.faceStyle.kind !== 'photo') return;
    const next = [...die.faceStyle.uris];
    next[index] = null;
    onChangeFaceStyle({ kind: 'photo', uris: next });
  };

  const handleDone = () => {
    if (die?.faceStyle.kind === 'photo') {
      const missing = die.faceStyle.uris.filter((u) => !u).length;
      if (missing > 0) {
        Alert.alert(
          'Faltan fotos',
          `Elige una foto para las ${missing} cara${missing === 1 ? '' : 's'} que ${missing === 1 ? 'falta' : 'faltan'}, o cambia a otro tipo de cara.`
        );
        return;
      }
    }
    onClose();
  };

  return (
    <Modal visible={die !== null} animationType="fade" transparent onRequestClose={handleDone}>
      <Pressable style={styles.backdrop} onPress={handleDone}>
        <Pressable
          style={[styles.sheet, { width: Math.min(vw * 0.92, 440), maxHeight: vh * 0.85 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>Configurar dado</Text>
          {die && (
            <TextInput
              style={styles.nameInput}
              value={die.name ?? ''}
              onChangeText={onChangeName}
              placeholder={`Nombre (ej. "${die.type}", "Jugador 1")`}
              placeholderTextColor="#666"
              maxLength={24}
            />
          )}
          {die && (
            <Text style={styles.probabilityText}>
              Cada resultado (1 a {DIE_SIDES[die.type]}) tiene 1/{DIE_SIDES[die.type]} de probabilidad —{' '}
              {(100 / DIE_SIDES[die.type]).toFixed(DIE_SIDES[die.type] >= 20 ? 1 : 2)}% cada uno. Es física real, no
              un número inventado: el resultado es la cara que efectivamente queda hacia arriba.
            </Text>
          )}

          <ScrollView
            style={[styles.scroll, { maxHeight: vh * 0.5 }]}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.sectionLabel}>Tipo</Text>
            <View style={styles.grid}>
              {DIE_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => die && onChangeType(t)}
                  style={[styles.typeChip, die?.type === t && styles.chipSelected]}
                >
                  <Text style={[styles.typeChipText, die?.type === t && styles.chipTextSelected]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Color</Text>
            <View style={styles.grid}>
              {DIE_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => die && onChangeColor(c)}
                  style={[styles.colorSwatch, { backgroundColor: c }, die?.color === c && styles.chipSelected]}
                />
              ))}
            </View>

            {hasFaces && (
              <>
                <Text style={styles.sectionLabel}>Tipo de caras</Text>
                <View style={styles.grid}>
                  <Pressable
                    onPress={() => onChangeFaceStyle({ kind: 'numbers' })}
                    style={[styles.typeChip, die?.faceStyle.kind === 'numbers' && styles.chipSelected]}
                  >
                    <Text style={[styles.typeChipText, die?.faceStyle.kind === 'numbers' && styles.chipTextSelected]}>
                      Numérico
                    </Text>
                  </Pressable>
                  {pipsAllowed && (
                    <Pressable
                      onPress={() => onChangeFaceStyle({ kind: 'pips' })}
                      style={[styles.typeChip, die?.faceStyle.kind === 'pips' && styles.chipSelected]}
                    >
                      <Text style={[styles.typeChipText, die?.faceStyle.kind === 'pips' && styles.chipTextSelected]}>
                        Puntos
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={enableDrawingMode}
                    style={[styles.typeChip, isDrawing && styles.chipSelected]}
                  >
                    <Text style={[styles.typeChipText, isDrawing && styles.chipTextSelected]}>Dibujos</Text>
                  </Pressable>
                </View>

                {isDrawing && (
                  <>
                    <Text style={styles.sectionLabel}>Modo de dibujo</Text>
                    <View style={styles.grid}>
                      <Pressable
                        onPress={enableIconMode}
                        style={[styles.typeChip, die?.faceStyle.kind === 'icon' && styles.chipSelected]}
                      >
                        <Text style={[styles.typeChipText, die?.faceStyle.kind === 'icon' && styles.chipTextSelected]}>
                          Iconos
                        </Text>
                      </Pressable>
                      {photoModeAllowed && (
                        <Pressable
                          onPress={enablePhotoMode}
                          style={[styles.typeChip, die?.faceStyle.kind === 'photo' && styles.chipSelected]}
                        >
                          <Text style={[styles.typeChipText, die?.faceStyle.kind === 'photo' && styles.chipTextSelected]}>
                            Fotos
                          </Text>
                        </Pressable>
                      )}
                    </View>
                    {!photoModeAllowed && die?.faceStyle.kind !== 'photo' && (
                      <Text style={styles.helperText}>
                        Las fotos por cara solo están disponibles hasta d10 ({faceCount} caras es demasiado).
                      </Text>
                    )}
                  </>
                )}

                {die?.faceStyle.kind === 'icon' && (
                  <>
                    <Text style={styles.sectionLabel}>
                      Dibujo por cara ({die.faceStyle.icons.filter(Boolean).length}/{faceCount}) — toca una cara y
                      luego un dibujo
                    </Text>
                    <View style={styles.grid}>
                      {die.faceStyle.icons.map((icon, i) => (
                        <Pressable
                          key={i}
                          onPress={() => setSelectedFace(i)}
                          style={[styles.faceSlot, selectedFace === i && styles.faceSlotSelected]}
                        >
                          {icon ? (
                            <>
                              <Text style={styles.faceSlotIconText}>{ICON_SHORT[icon]}</Text>
                              <Pressable
                                onPress={() => setFaceIcon(i, null)}
                                hitSlop={8}
                                style={styles.faceSlotClear}
                              >
                                <Text style={styles.faceSlotClearText}>×</Text>
                              </Pressable>
                            </>
                          ) : (
                            <Text style={styles.faceSlotPlaceholder}>{i + 1}</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.sectionLabel}>Cara {selectedFace + 1}: elige un dibujo</Text>
                    <View style={styles.grid}>
                      {ICON_TYPES.map((icon) => {
                        const selected = die.faceStyle.kind === 'icon' && die.faceStyle.icons[selectedFace] === icon;
                        return (
                          <Pressable
                            key={icon}
                            onPress={() => setFaceIcon(selectedFace, icon)}
                            style={[styles.typeChip, selected && styles.chipSelected]}
                          >
                            <Text style={[styles.typeChipText, selected && styles.chipTextSelected]}>
                              {ICON_LABELS[icon]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable
                      onPress={() => {
                        const current = die.faceStyle.kind === 'icon' ? die.faceStyle.icons[selectedFace] : null;
                        if (current) fillAllIcons(current);
                      }}
                      style={styles.fillAllButton}
                    >
                      <Text style={styles.fillAllButtonText}>Aplicar este dibujo a todas las caras</Text>
                    </Pressable>
                  </>
                )}

                {die?.faceStyle.kind === 'photo' && (
                  <>
                    <Text
                      style={[
                        styles.sectionLabel,
                        die.faceStyle.uris.some((u) => !u) && styles.sectionLabelWarning,
                      ]}
                    >
                      Elige una foto para cada cara ({die.faceStyle.uris.filter(Boolean).length}/
                      {die.faceStyle.uris.length})
                    </Text>
                    <View style={styles.grid}>
                      {die.faceStyle.uris.map((uri, i) => (
                        <Pressable key={i} onPress={() => pickPhotoForFace(i)} style={styles.faceSlot}>
                          {uri ? (
                            <>
                              <Image source={{ uri }} style={styles.faceSlotImage} />
                              <Pressable
                                onPress={() => clearFacePhoto(i)}
                                hitSlop={8}
                                style={styles.faceSlotClear}
                              >
                                <Text style={styles.faceSlotClearText}>×</Text>
                              </Pressable>
                            </>
                          ) : (
                            <Text style={styles.faceSlotPlaceholder}>{i + 1}</Text>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={onRemove} style={styles.removeButton}>
              <Text style={styles.removeButtonText}>Quitar dado</Text>
            </Pressable>
            <Pressable onPress={handleDone} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Listo</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#1c1c1c',
    borderRadius: 20,
    padding: 20,
    paddingBottom: 24,
  },
  scroll: {},
  scrollContent: {
    paddingBottom: 12,
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#2b2b2b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: 'white',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  probabilityText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionLabelWarning: {
    color: '#ffb74d',
  },
  helperText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2b2b2b',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeChipText: {
    color: '#ccc',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#111',
  },
  chipSelected: {
    backgroundColor: '#4fc3f7',
    borderColor: 'white',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  faceSlot: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2b2b2b',
    borderWidth: 1,
    borderColor: '#444',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  faceSlotSelected: {
    borderColor: '#4fc3f7',
    borderStyle: 'solid',
    borderWidth: 2,
  },
  faceSlotPlaceholder: {
    color: '#666',
    fontWeight: '600',
  },
  faceSlotIconText: {
    color: '#eee',
    fontSize: 10,
    fontWeight: '700',
  },
  fillAllButton: {
    backgroundColor: '#2b2b2b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  fillAllButtonText: {
    color: '#4fc3f7',
    fontWeight: '600',
    fontSize: 13,
  },
  faceSlotImage: {
    width: 46,
    height: 46,
    borderRadius: 7,
  },
  faceSlotClear: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#c62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceSlotClearText: {
    color: 'white',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  removeButton: {
    flex: 1,
    backgroundColor: '#3a1f1f',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#ff8a80',
    fontWeight: '600',
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#4fc3f7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#111',
    fontWeight: '700',
  },
});
