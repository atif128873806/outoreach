/** A single stroke system for functional navigation and actions. */
const paths = {
  search: 'm21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  leads: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plan: 'M3 5h18v14H3zM3 10h18M7 15h3',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  help: 'M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  shield: 'M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7l-9-4Zm-4 9 3 3 5-6',
  logout: 'M9 4H4v16h5m5-12 4 4-4 4m-6-4h10',
  mail: 'M3 5h18v14H3zM3 5l9 7 9-7',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  plus: 'M12 5v14M5 12h14',
  map: 'M12 21s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12ZM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
} as const;
export type IconName = keyof typeof paths;
export default function Icon({name,className='h-5 w-5'}:{name:IconName;className?:string}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name]}/></svg>;
}
