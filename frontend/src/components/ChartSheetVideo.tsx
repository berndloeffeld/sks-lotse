// A video walk-through of each official sheet, by the YouTube channel McFly439 ("[SKS Kartenaufgaben
// erklärt!] Bogen N", same numbering as the WSV sheets). Only linked, never embedded: an embed would
// load YouTube's scripts into the page (CLAUDE.md: no third-party script but Umami).
const CHANNEL = 'https://www.youtube.com/@LauraMcFly439'

const VIDEO_IDS: Record<number, string> = {
  1: 'HaHfmZLW198',
  2: 'UssPjvyIg30',
  3: 'n_PDYYMrxJI',
  4: 'S3C5MfLeOao',
  5: 'iSTVUAEBymE',
  6: 'QXto9uRgpXk',
}

export function ChartSheetVideo({ number }: { number: number }) {
  const id = VIDEO_IDS[number]
  if (!id) return null
  return (
    <p className="text-sm text-ink-soft">
      Lieber erklärt bekommen? Zu diesem Bogen gibt es eine{' '}
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:no-underline"
      >
        Video-Anleitung auf YouTube
      </a>{' '}
      vom Kanal{' '}
      <a href={CHANNEL} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
        McFly439
      </a>{' '}
      (externe Seite, nicht von SKS Lotse).
    </p>
  )
}
