import { Modal, View, Text, Pressable, StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { DieInstanceConfig, hasNumericValue } from '../dice/types';

interface ResultsListModalProps {
  visible: boolean;
  dice: DieInstanceConfig[];
  values: Record<string, number>;
  onClose: () => void;
}

export function ResultsListModal({ visible, dice, values, onClose }: ResultsListModalProps) {
  const { width: vw, height: vh } = useWindowDimensions();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { width: Math.min(vw * 0.92, 440), maxHeight: vh * 0.75 }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>Resultados</Text>
          <FlatList
            data={dice}
            keyExtractor={(d) => d.id}
            style={[styles.list, { maxHeight: vh * 0.5 }]}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item, index }) => (
              <View style={styles.row}>
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name?.trim() || `Dado ${index + 1} (${item.type})`}
                </Text>
                <Text style={styles.rowValue}>
                  {hasNumericValue(item.faceStyle) ? values[item.id] ?? '-' : '—'}
                </Text>
              </View>
            )}
          />
          <Pressable onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Listo</Text>
          </Pressable>
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
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  separator: {
    height: 1,
    backgroundColor: '#2b2b2b',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  rowName: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  rowValue: {
    color: '#4fc3f7',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'right',
  },
  doneButton: {
    backgroundColor: '#4fc3f7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    color: '#111',
    fontWeight: '700',
  },
});
