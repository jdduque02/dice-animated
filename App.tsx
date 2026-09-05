import { useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { Scene, SceneHandle } from './src/components/Scene';
import { DieConfigModal, DIE_COLORS } from './src/components/DieConfigModal';
import { ResultsListModal } from './src/components/ResultsListModal';
import { DieInstanceConfig, DieType, FaceStyle, DIE_SIDES, hasNumericValue } from './src/dice/types';

let nextId = 1;
function makeId() {
  return `die-${nextId++}`;
}

export default function App() {
  const sceneRef = useRef<SceneHandle>(null);
  const [dice, setDice] = useState<DieInstanceConfig[]>([
    { id: makeId(), type: 'd6', color: DIE_COLORS[0], faceStyle: { kind: 'numbers' } },
  ]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  const total = useMemo(
    () => dice.reduce((sum, d) => sum + (hasNumericValue(d.faceStyle) ? values[d.id] ?? 0 : 0), 0),
    [dice, values]
  );
  const configuringDie = dice.find((d) => d.id === configuringId) ?? null;

  const handleDieSettled = (id: string, value: number) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const addDie = () => {
    const id = makeId();
    const color = DIE_COLORS[dice.length % DIE_COLORS.length];
    setDice((prev) => [...prev, { id, type: 'd6', color, faceStyle: { kind: 'numbers' } }]);
    setConfiguringId(id);
  };

  const removeDie = (id: string) => {
    setDice((prev) => prev.filter((d) => d.id !== id));
    setValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setConfiguringId(null);
  };

  const setDieType = (id: string, type: DieType) => {
    setDice((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        // A photo/icon assignment is tied one-to-one to the old type's face count —
        // it can't carry over to a different type, so fall back to numbers. Pips have
        // no per-face data to go stale, but only have a canonical dot layout up to 6.
        const newFaceCount = DIE_SIDES[type];
        const stale =
          (d.faceStyle.kind === 'photo' && d.faceStyle.uris.length !== newFaceCount) ||
          (d.faceStyle.kind === 'icon' && d.faceStyle.icons.length !== newFaceCount) ||
          (d.faceStyle.kind === 'pips' && newFaceCount > 6);
        const faceStyle: FaceStyle = stale ? { kind: 'numbers' } : d.faceStyle;
        return { ...d, type, faceStyle };
      })
    );
    setValues((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setDieColor = (id: string, color: string) => {
    setDice((prev) => prev.map((d) => (d.id === id ? { ...d, color } : d)));
  };

  const setDieFaceStyle = (id: string, faceStyle: FaceStyle) => {
    setDice((prev) => prev.map((d) => (d.id === id ? { ...d, faceStyle } : d)));
  };

  const setDieName = (id: string, name: string) => {
    setDice((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <View style={styles.topBarCenter}>
          <Text style={styles.totalLabel}>Suma total</Text>
          <Text style={styles.totalValue}>{total}</Text>
        </View>
        <View style={styles.topBarSpacer}>
          <Pressable style={styles.listButton} onPress={() => setResultsOpen(true)}>
            <Text style={styles.listButtonText}>Lista</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.canvasArea}>
        <Scene ref={sceneRef} dice={dice} onDieSettled={handleDieSettled} />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => sceneRef.current?.rollAll()}>
          <Text style={styles.hint}>Toca la pantalla para tirar</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionLabel}>Dados (toca uno para configurarlo)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {dice.map((d) => (
            <Pressable key={d.id} style={styles.dieCard} onPress={() => setConfiguringId(d.id)}>
              {dice.length > 1 && (
                <Pressable onPress={() => removeDie(d.id)} hitSlop={8} style={styles.dieCardRemove}>
                  <Text style={styles.dieCardRemoveText}>×</Text>
                </Pressable>
              )}
              <View style={[styles.colorDot, { backgroundColor: d.color }]} />
              <Text style={styles.dieType} numberOfLines={1}>
                {d.name?.trim() || d.type}
              </Text>
              <Text style={styles.dieValue}>{hasNumericValue(d.faceStyle) ? values[d.id] ?? '-' : '—'}</Text>
            </Pressable>
          ))}
          <Pressable onPress={addDie} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Dado</Text>
          </Pressable>
        </ScrollView>
      </View>

      <DieConfigModal
        die={configuringDie}
        onChangeType={(type) => configuringDie && setDieType(configuringDie.id, type)}
        onChangeColor={(color) => configuringDie && setDieColor(configuringDie.id, color)}
        onChangeFaceStyle={(style) => configuringDie && setDieFaceStyle(configuringDie.id, style)}
        onChangeName={(name) => configuringDie && setDieName(configuringDie.id, name)}
        onRemove={() => configuringDie && removeDie(configuringDie.id)}
        onClose={() => setConfiguringId(null)}
      />

      <ResultsListModal
        visible={resultsOpen}
        dice={dice}
        values={values}
        onClose={() => setResultsOpen(false)}
      />

      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  topBar: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarSpacer: {
    width: 76,
    alignItems: 'flex-end',
  },
  listButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  listButtonText: {
    color: '#4fc3f7',
    fontSize: 13,
    fontWeight: '700',
  },
  totalLabel: {
    color: '#aaa',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalValue: {
    color: 'white',
    fontSize: 40,
    fontWeight: '700',
  },
  canvasArea: {
    flex: 1,
  },
  hint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  panel: {
    backgroundColor: '#181818',
    paddingTop: 12,
    paddingBottom: 28,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 16,
    marginBottom: 8,
  },
  row: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dieCard: {
    backgroundColor: '#242424',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    width: 76,
    overflow: 'visible',
  },
  dieCardRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#c62828',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dieCardRemoveText: {
    color: 'white',
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '700',
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dieType: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  dieValue: {
    color: '#4fc3f7',
    fontSize: 13,
    marginTop: 2,
  },
  addButton: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#4fc3f7',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
});
