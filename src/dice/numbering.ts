import { FaceGroup } from './faceGroups';

/**
 * Assigns 1..N to each face group. Geometrically opposite faces (normals pointing
 * in nearly opposite directions — true for d6/d8/d10/d12/d20) are paired so their
 * values sum to N+1, matching the standard convention on real dice. Faces without a
 * true opposite (d4, whose faces are opposite a vertex, not another face) just get
 * the next free number.
 */
export function assignNumbers(groups: FaceGroup[]): number[] {
  const n = groups.length;
  const pairedWith = new Array<number>(n).fill(-1);

  for (let i = 0; i < n; i++) {
    if (pairedWith[i] !== -1) continue;
    let bestJ = -1;
    let bestScore = -1;
    for (let j = 0; j < n; j++) {
      if (j === i || pairedWith[j] !== -1) continue;
      const score = -groups[i].normal.dot(groups[j].normal);
      if (score > bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }
    if (bestJ !== -1 && bestScore > 0.9) {
      pairedWith[i] = bestJ;
      pairedWith[bestJ] = i;
    }
  }

  const numbers = new Array<number>(n).fill(0);
  const visited = new Array<boolean>(n).fill(false);
  let next = 1;

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const j = pairedWith[i];
    if (j !== -1 && !visited[j]) {
      numbers[i] = next;
      numbers[j] = n + 1 - next;
      visited[i] = true;
      visited[j] = true;
    } else {
      numbers[i] = next;
      visited[i] = true;
    }
    next++;
  }

  return numbers;
}
