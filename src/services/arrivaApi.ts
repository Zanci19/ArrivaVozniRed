import md5 from 'md5';

const BASE_URL = 'https://prometws.alpetour.si';

// Use a CORS proxy since the Arriva API does not send CORS headers for browser requests.
// NOTE: The proxy operator can see request/response data. For a production deployment,
// replace this with a self-hosted proxy or server-side proxy endpoint.
const CORS_PROXY = 'https://corsproxy.io/?';

// Public API token seed used by all Arriva Slovenia timetable clients (not user-specific).
// Source: https://github.com/Golobii/arriva-cli – this value is already publicly documented.
const API_TOKEN_SEED = 'R300_VozniRed_2015';

export interface Station {
  id: number;
  name: string;
}

export interface Departure {
  routeName: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  durationFormatted: string;
  distanceKm: number;
  price: number;
  note: string;
}

function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  return `${year}${month}${day}${hour}0000`;
}

function generateToken(timestamp: string): string {
  return md5(API_TOKEN_SEED + timestamp);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function apiFetch(url: string): Promise<unknown> {
  // First try direct, then fall back to CORS proxy
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) return res.json();
  } catch {
    // Fallback to CORS proxy
  }
  const proxied = await fetch(CORS_PROXY + encodeURIComponent(url));
  return proxied.json();
}

export async function fetchStations(): Promise<Station[]> {
  const timestamp = getTimestamp();
  const token = generateToken(timestamp);
  const url = `${BASE_URL}/WS_ArrivaSLO_TimeTable_DepartureStations.aspx?cTimeStamp=${timestamp}&cToken=${token}&json=1`;

  const data = await apiFetch(url) as Array<{
    DepartureStations: Array<{ JPOS_IJPP: number; POS_NAZ: string }>;
    Error: string;
  }>;

  if (!data || !Array.isArray(data) || data.length === 0) return [];
  const raw = data[0]?.DepartureStations ?? [];
  return raw.map((s) => ({ id: s.JPOS_IJPP, name: s.POS_NAZ }));
}

export async function fetchDepartures(
  fromId: number,
  toId: number,
  date: string // YYYY-MM-DD
): Promise<Departure[]> {
  const timestamp = getTimestamp();
  const token = generateToken(timestamp);
  // NOTE: JPOS_IJPPZ = destination id, JPOS_IJPPK = origin id (per arriva-cli source)
  const url =
    `${BASE_URL}/WS_ArrivaSLO_TimeTable_TimeTableDepartures.aspx` +
    `?cTimeStamp=${timestamp}&cToken=${token}` +
    `&JPOS_IJPPZ=${toId}&JPOS_IJPPK=${fromId}` +
    `&VZVK_DAT=${date}&json=1`;

  const data = await apiFetch(url) as Array<{
    Departures: Array<{
      RPR_NAZ: string;
      ROD_IODH: string;
      ROD_IPRI: string;
      ROD_CAS: number;
      ROD_KM: number;
      VZCL_CEN: number;
      ROD_OPO: string;
    }>;
    Error: string;
    ErrorMsg: string;
  }>;

  if (!data || !Array.isArray(data) || data.length === 0) return [];
  if (data[0]?.Error !== '0') return [];

  return (data[0]?.Departures ?? []).map((d) => ({
    routeName: d.RPR_NAZ,
    departureTime: d.ROD_IODH,
    arrivalTime: d.ROD_IPRI,
    durationMinutes: d.ROD_CAS,
    durationFormatted: formatDuration(d.ROD_CAS),
    distanceKm: d.ROD_KM,
    price: d.VZCL_CEN,
    note: d.ROD_OPO,
  }));
}
