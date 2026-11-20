import { experiment, type Config } from "./statistics";
self.onmessage = (event: MessageEvent<Config>) => {
  try {
    const result = experiment(event.data, (done, total) =>
      self.postMessage({ type: "progress", done, total }),
    );
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({ type: "error", message: String(error) });
  }
};
