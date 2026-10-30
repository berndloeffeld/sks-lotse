import type { ReactNode } from 'react'

// A video walk-through of each official sheet, by the YouTube channel McFly439 ("[SKS Kartenaufgaben
// erklärt!] Bogen N", same numbering as the WSV sheets). Only linked, never embedded: an embed would
// load YouTube's scripts into the page (CLAUDE.md: no third-party script but Umami).
const CHANNEL = 'https://www.youtube.com/@LauraMcFly439'

// Per sheet the video and, per task (index = task number − 1), where it starts in seconds, from the
// chapter marks in the video's description. Sheet 4, task 10 has none: its mark there (38:50) lies
// after task 18's, a typo.
const VIDEOS: Record<number, { id: string; starts: (number | null)[] }> = {
  1: {
    id: 'HaHfmZLW198',
    starts: [26, 190, 287, 365, 411, 519, 584, 651, 709, 743, 760, 840, 863, 994, 1229, 1319, 1480, 1527],
  },
  2: {
    id: 'UssPjvyIg30',
    starts: [44, 268, 345, 366, 401, 512, 630, 797, 816, 875, 924, 979, 1371, 1575, 1657, 1691, 1711, 1826],
  },
  3: {
    id: 'n_PDYYMrxJI',
    starts: [49, 214, 335, 371, 404, 471, 631, 762, 773, 851, 887, 987, 1196, 1230, 1327, 1400, 1765, 1835],
  },
  4: {
    id: 'S3C5MfLeOao',
    starts: [72, 245, 295, 520, 898, 1045, 1126, 1329, 1385, null, 1575, 1624, 1670, 1709, 1918, 1966, 2050, 2237],
  },
  5: {
    id: 'iSTVUAEBymE',
    starts: [37, 69, 117, 424, 515, 543, 720, 783, 864, 912, 1252, 1405, 1595, 1693, 1735, 1771, 1795, 1949],
  },
  6: {
    id: 'QXto9uRgpXk',
    starts: [41, 399, 474, 673, 705, 763, 864, 1056, 1098, 1137, 1271, 1548, 1662, 2221, 2278, 2328, 2371, 2466],
  },
  7: {
    id: '__qMs5IH-t4',
    starts: [32, 71, 100, 133, 197, 217, 364, 432, 569, 659, 954, 1054, 1426, 1464, 1574, 1602, 1620, 1666],
  },
  8: {
    id: 'RMi2Hwe1HMg',
    starts: [43, 155, 285, 647, 814, 849, 1012, 1077, 1222, 1268, 1409, 1437, 1471, 1547, 1653, 1678, 1923, 1980],
  },
}

const LINK = 'text-primary underline hover:no-underline'

function videoUrl(id: string, start?: number | null): string {
  return `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`
}

/** On a sheet's page, before the run: the whole video. */
export function ChartSheetVideo({ number }: { number: number }) {
  const video = VIDEOS[number]
  if (!video) return null
  return (
    <p className="text-sm text-ink-soft">
      Lieber erklärt bekommen? Zu diesem Bogen gibt es eine{' '}
      <a href={videoUrl(video.id)} target="_blank" rel="noopener noreferrer" className={LINK}>
        Video-Anleitung auf YouTube
      </a>{' '}
      vom Kanal{' '}
      <a href={CHANNEL} target="_blank" rel="noopener noreferrer" className={LINK}>
        McFly439
      </a>
      .
    </p>
  )
}

/** During a run, among the tools (ChartTools): the video, started at the current task where its
 * description marks it. Styled by the caller, as a card header or a button in the phone's bar. */
export function ChartTaskVideo({
  sheet,
  task,
  className,
  children,
}: {
  sheet: number
  task: number
  className: string
  children: ReactNode
}) {
  const video = VIDEOS[sheet]
  if (!video) return null
  return (
    <a
      href={videoUrl(video.id, video.starts[task - 1])}
      target="_blank"
      rel="noopener noreferrer"
      title={`Video-Erklärung zu Aufgabe ${task} auf YouTube (Kanal McFly439)`}
      className={className}
    >
      {children}
    </a>
  )
}
