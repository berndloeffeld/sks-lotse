// "1 Punkt" / "2 Punkte" — the Kartenaufgaben state every task's and question's worth this way.
export function pointsLabel(points: number) {
  return points === 1 ? '1 Punkt' : `${points} Punkte`
}
