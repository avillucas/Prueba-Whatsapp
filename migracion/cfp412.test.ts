import { DecisionEngine } from "./DecisionEngine";
import { cfp412Mockup } from "../data/cfp412Mockup";

describe("CFP 412 Decision Engine Flow", () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine(cfp412Mockup, "MSG_INICIAL");
  });

  it("should initialize at MSG_INICIAL", () => {
    const node = engine.getCurrentNode();
    expect(node.id).toBe("MSG_INICIAL");
    expect(node.extractData).toBe("Opcion_Elegida");
  });

  it("should flow to RESP_A and then MSG_CIERRE when selecting A", () => {
    const { nextNode: nodeA, extractedData: dataA } = engine.processAnswer("A");
    expect(nodeA?.id).toBe("RESP_A");
    expect(dataA).toBeDefined();
    expect(dataA?.key).toBe("Opcion_Elegida");
    expect(dataA?.value).toBe("A");

    // Any answer goes to MSG_CIERRE
    const { nextNode: nodeCierre, extractedData: dataCierre } = engine.processAnswer("Gracias");
    expect(nodeCierre?.id).toBe("MSG_CIERRE");
    // MSG_CIERRE has Accion_Reinicio but it shouldn't extract on transition INTO it, 
    // it extracts on transition OUT OF it. Wait, the extraction happens on the transition FROM the current node.
    // The previous node was RESP_A, which has no extractData.
    expect(dataCierre).toBeUndefined();
  });

  it("should flow to RESP_B and then MSG_CIERRE when selecting B", () => {
    const { nextNode: nodeB } = engine.processAnswer("B");
    expect(nodeB?.id).toBe("RESP_B");

    const { nextNode: nodeCierre } = engine.processAnswer("OK");
    expect(nodeCierre?.id).toBe("MSG_CIERRE");
  });

  it("should complete the C flow (Lista de espera)", () => {
    const { nextNode: nodeC1, extractedData: dataC1 } = engine.processAnswer("C");
    expect(nodeC1?.id).toBe("RESP_C_1");
    expect(dataC1?.value).toBe("C");

    const { nextNode: nodeC2, extractedData: dataC2 } = engine.processAnswer("Juan Perez");
    expect(nodeC2?.id).toBe("RESP_C_2");
    expect(dataC2?.key).toBe("Nombre_y_Apellido");
    expect(dataC2?.value).toBe("Juan Perez");

    const { nextNode: nodeC3, extractedData: dataC3 } = engine.processAnswer("juan@email.com");
    expect(nodeC3?.id).toBe("RESP_C_3");
    expect(dataC3?.key).toBe("Telefono_WhatsApp_Email");
    expect(dataC3?.value).toBe("juan@email.com");

    const { nextNode: nodeCFin, extractedData: dataCFin } = engine.processAnswer("Mecánica");
    expect(nodeCFin?.id).toBe("RESP_C_FIN");
    expect(dataCFin?.key).toBe("Curso_Interes");
    expect(dataCFin?.value).toBe("Mecánica");

    const { nextNode: nodeCierre } = engine.processAnswer("Gracias");
    expect(nodeCierre?.id).toBe("MSG_CIERRE");
  });

  it("should flow to RESP_D and then MSG_CIERRE when selecting D", () => {
    const { nextNode: nodeD } = engine.processAnswer("D");
    expect(nodeD?.id).toBe("RESP_D");

    const { nextNode: nodeCierre } = engine.processAnswer("Gracias");
    expect(nodeCierre?.id).toBe("MSG_CIERRE");
  });

  it("should flow to RESP_E and then MSG_CIERRE when selecting E", () => {
    const { nextNode: nodeE } = engine.processAnswer("E");
    expect(nodeE?.id).toBe("RESP_E");

    const { nextNode: nodeCierre } = engine.processAnswer("Gracias");
    expect(nodeCierre?.id).toBe("MSG_CIERRE");
  });

  it("should flow to RESP_F and then MSG_CIERRE when selecting F", () => {
    const { nextNode: nodeF } = engine.processAnswer("F");
    expect(nodeF?.id).toBe("RESP_F");

    const { nextNode: nodeCierre } = engine.processAnswer("Gracias");
    expect(nodeCierre?.id).toBe("MSG_CIERRE");
  });

  it("should complete the G flow (Consulta Personalizada)", () => {
    const { nextNode: nodeG1 } = engine.processAnswer("G");
    expect(nodeG1?.id).toBe("RESP_G_1");

    const { nextNode: nodeG2, extractedData: dataG2 } = engine.processAnswer("Maria Gomez");
    expect(nodeG2?.id).toBe("RESP_G_2");
    expect(dataG2?.key).toBe("Nombre_y_Apellido");
    expect(dataG2?.value).toBe("Maria Gomez");

    const { nextNode: nodeG3, extractedData: dataG3 } = engine.processAnswer("1123456789");
    expect(nodeG3?.id).toBe("RESP_G_3");
    expect(dataG3?.key).toBe("Telefono_WhatsApp_Email");

    const { nextNode: nodeGFin, extractedData: dataGFin } = engine.processAnswer("Quería saber si hay vacantes en plomería");
    expect(nodeGFin?.id).toBe("RESP_G_FIN");
    expect(dataGFin?.key).toBe("Consulta_Personalizada");
    expect(dataGFin?.value).toBe("Quería saber si hay vacantes en plomería");

    const { nextNode: nodeCierre } = engine.processAnswer("OK");
    expect(nodeCierre?.id).toBe("MSG_CIERRE");
  });

  it("should loop back to MSG_INICIAL from MSG_CIERRE when typing 'VER MENU'", () => {
    engine.processAnswer("A");
    engine.processAnswer("ok");
    // now we are at MSG_CIERRE
    expect(engine.getCurrentNode().id).toBe("MSG_CIERRE");

    const { nextNode: nodeInit, extractedData } = engine.processAnswer("VER MENU");
    expect(nodeInit?.id).toBe("MSG_INICIAL");
    expect(extractedData?.key).toBe("Accion_Reinicio");
    expect(extractedData?.value).toBe("VER MENU");
  });

  it("should stay at MSG_CIERRE when typing anything else", () => {
    engine.processAnswer("A");
    engine.processAnswer("ok");
    
    const { nextNode: nodeCierre2 } = engine.processAnswer("Hola de nuevo");
    expect(nodeCierre2?.id).toBe("MSG_CIERRE");
  });

  it("should handle lowercase options like 'a' for flow A", () => {
    const { nextNode: nodeA } = engine.processAnswer("a");
    expect(nodeA?.id).toBe("RESP_A");
  });

  it("should handle lowercase 'ver menu'", () => {
    engine.processAnswer("a");
    engine.processAnswer("ok");
    
    const { nextNode: nodeInit } = engine.processAnswer("ver menu");
    expect(nodeInit?.id).toBe("MSG_INICIAL");
  });
});
