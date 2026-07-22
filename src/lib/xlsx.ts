import { strFromU8, unzipSync } from 'fflate';

// 법인카드 사용내역 엑셀(SAP 내보내기 형식) 브라우저 파싱.
// scripts/parse-xlsx.mjs 와 같은 컬럼 규칙: D 증빙일, J 금액, K 품목텍스트, M 계정번호(카드)

export interface Tx {
  date: string; // YYYYMMDD
  amount: number;
  card: string;
  account: string;
  synth: boolean;
}

// 카드 소지자 실명 마스킹 ("현대법인카드_이충환" → "현대법인카드_이*환")
export function maskCard(card: string): string {
  return card.replace(/_(\S+)$/, (_, name: string) =>
    name.length >= 2 ? `_${name[0]}${'*'.repeat(name.length - 2)}${name.slice(-1)}` : `_${name}`
  );
}

export function parseCardXlsx(buf: ArrayBuffer): Tx[] {
  const files = unzipSync(new Uint8Array(buf));

  const sstFile = files['xl/sharedStrings.xml'];
  const sst: string[] = sstFile
    ? [...strFromU8(sstFile).matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
        [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join('')
      )
    : [];

  const sheetName = Object.keys(files).find((k) => /^xl\/worksheets\/sheet1?\.xml$/.test(k));
  if (!sheetName) throw new Error('워크시트를 찾을 수 없습니다');
  const sheet = strFromU8(files[sheetName]);

  const txs: Tx[] = [];
  for (const rm of sheet.matchAll(/<row [^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
    if (rm[1] === '1') continue; // header
    const cells: Record<string, string> = {};
    for (const cm of rm[2].matchAll(/<c r="([A-Z]+)\d+"[^>]*?(t="s")?\s*><v>([^<]*)<\/v><\/c>/g)) {
      const [, col, isStr, v] = cm;
      cells[col] = isStr ? (sst[Number(v)] ?? '') : v;
    }
    const date = String(cells.D ?? '').trim().replace(/\.0$/, '');
    const amount = Number(String(cells.J ?? '0').replace(/[^\d]/g, ''));
    if (!date || !(amount > 0)) continue;
    txs.push({
      date,
      amount,
      card: maskCard(String(cells.M ?? '').trim()),
      account: '의욕관리비',
      synth: false,
    });
  }
  if (txs.length === 0) throw new Error('유효한 거래 행이 없습니다 (형식을 확인해 주세요)');
  return txs;
}
