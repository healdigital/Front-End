declare module 'express' {
  export interface Request {
    method: string;
  }

  export interface Response {
    header(name: string, value: string): this;
    sendStatus(code: number): this;
    json(body: unknown): this;
  }

  export type NextFunction = () => void;

  export interface ExpressApp {
    use(...args: unknown[]): void;
    get(path: string, handler: (req: Request, res: Response) => void): void;
    listen(port: number, host: string, callback?: () => void): void;
  }

  export interface ExpressStatic {
    (): ExpressApp;
    json(options?: unknown): unknown;
    urlencoded(options?: unknown): unknown;
  }

  const express: ExpressStatic;
  export default express;
}
