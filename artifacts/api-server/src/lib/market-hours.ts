export type MarketSession = "OPEN" | "PRE" | "CLOSED";

export interface MarketStatus {
  isOpen: boolean;
  session: MarketSession;
  nextEvent: string;
}

function getISTTime(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 60 * 60 * 1000);
}

export function getMarketStatus(): MarketStatus {
  const ist = getISTTime();
  const day = ist.getDay();
  const h = ist.getHours();
  const m = ist.getMinutes();
  const totalMin = h * 60 + m;

  if (day === 0 || day === 6) {
    return { isOpen: false, session: "CLOSED", nextEvent: "Next Monday 09:15" };
  }

  const preStart = 9 * 60;
  const marketOpen = 9 * 60 + 15;
  const marketClose = 15 * 60 + 30;

  if (totalMin >= marketOpen && totalMin < marketClose) {
    const remaining = marketClose - totalMin;
    return { isOpen: true, session: "OPEN", nextEvent: `Close in ${remaining} min` };
  }

  if (totalMin >= preStart && totalMin < marketOpen) {
    return { isOpen: false, session: "PRE", nextEvent: "Market opens at 09:15" };
  }

  return { isOpen: false, session: "CLOSED", nextEvent: "Next open 09:15" };
}

export function isMarketOpen(): boolean {
  return getMarketStatus().isOpen;
}
