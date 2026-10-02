export type WindowParams = {
  sizeDollars: number;
  bandLow: number;
  bandHigh: number;
  moveEarly: number;
  moveLate: number;
  takeProfitPct: number;
  finalExitBelow: number;
  finalHoldAbove: number;
  dailyLossCap: number;
};

export const defaultWindowParams: WindowParams = {
  sizeDollars: 5,
  bandLow: 0.28,
  bandHigh: 0.72,
  moveEarly: 60,
  moveLate: 120,
  takeProfitPct: 35,
  finalExitBelow: 0.75,
  finalHoldAbove: 0.8,
  dailyLossCap: 25,
};

export type MarketView = {
  ticker: string;
  yesAsk: number;
  elapsedMin: number;
  remainingSec: number;
  move: number;
};

export type DecideInput = {
  market: MarketView | null;
  params: WindowParams;
  hasPosition: boolean;
  entryPrice: number | null;
  dailyLoss: number;
  blocked: "unknown" | "quota" | null;
};

export type Decision = {
  action: "skip" | "enter" | "exit" | "shadow";
  sentence: string;
  price?: number;
};

function cents(price: number) {
  return `${Math.round(price * 100)}¢`;
}

export function decideWindow(input: DecideInput): Decision {
  const { market, params } = input;
  if (!market) {
    return { action: "skip", sentence: "Skipped. No open 15-minute BTC market right now." };
  }
  if (input.blocked === "unknown") {
    return {
      action: "skip",
      sentence: "Kalshi timed out. Checking whether the bid landed. Not sending another.",
    };
  }

  const band = `${cents(params.bandLow)}–${cents(params.bandHigh)}`;
  let action: Decision["action"] = "skip";
  let sentence = "Skipped.";

  if (input.dailyLoss >= params.dailyLossCap) {
    sentence = `Stopped for the day. Loss hit the $${params.dailyLossCap} cap.`;
  } else if (input.hasPosition && input.entryPrice) {
    const target = input.entryPrice * (1 + params.takeProfitPct / 100);
    if (market.remainingSec <= 90 && market.yesAsk < params.finalExitBelow) {
      action = "exit";
      sentence = `Selling. ${cents(market.yesAsk)} is under ${cents(params.finalExitBelow)} in the final window.`;
    } else if (market.remainingSec <= 90 && market.yesAsk >= params.finalHoldAbove) {
      sentence = `Holding. ${cents(market.yesAsk)} is above ${cents(params.finalHoldAbove)} with the window closing.`;
    } else if (market.yesAsk >= target) {
      action = "exit";
      sentence = `Selling. ${cents(market.yesAsk)} cleared the ${params.takeProfitPct}% target from ${cents(input.entryPrice)}.`;
    } else {
      sentence = `Holding ${cents(input.entryPrice)}. The contract is ${cents(market.yesAsk)}.`;
    }
  } else if (market.remainingSec <= 90) {
    sentence = "Skipped. Last 90 seconds. Your agent does not open a new trade.";
  } else if (market.elapsedMin < 3) {
    sentence = `Skipped. Minute ${Math.floor(market.elapsedMin)} of the window. Your agent watches until minute 3.`;
  } else if (market.yesAsk < params.bandLow || market.yesAsk > params.bandHigh) {
    sentence = `Skipped. ${cents(market.yesAsk)} is outside the ${band} band you set.`;
  } else {
    const need = market.elapsedMin >= 10 ? params.moveLate : params.moveEarly;
    if (market.move < need) {
      sentence = `Skipped. BTC has moved $${market.move.toFixed(0)} from the open. Your agent waits for $${need}.`;
    } else {
      action = "enter";
      sentence = `Bid sent at ${cents(market.yesAsk)}. Waiting to see it on Kalshi.`;
    }
  }

  if (input.blocked === "quota" && action === "enter") {
    return {
      action: "shadow",
      sentence: `Would have bought YES at ${cents(market.yesAsk)}. Free markets are used.`,
      price: market.yesAsk,
    };
  }
  if (input.blocked === "quota" && action === "exit") {
    return { action: "exit", sentence, price: market.yesAsk };
  }
  return { action, sentence, price: market.yesAsk };
}
