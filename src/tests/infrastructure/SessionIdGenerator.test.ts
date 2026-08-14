import { SessionIdGenerator } from "../../infrastructure/utils/SessionIdGenerator";

describe("SessionIdGenerator Infrastructure Utility", () => {
  it("Debería generar un sessionId válido trazable al remoteJid", () => {
    const id = SessionIdGenerator.generate("5491135204878@s.whatsapp.net");
    expect(id).toContain("5491135204878");
    expect(id.split("_").length).toBe(3);
  });
});
