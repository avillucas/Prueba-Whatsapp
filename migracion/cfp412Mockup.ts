import { DecisionNode } from "../domain/DecisionEngine";

export const cfp412Mockup: DecisionNode[] = [
  {
    id: "MSG_INICIAL",
    text: "👋 Hola, te comunicaste con el Centro Formación Profesional nº 412. ¿En qué podemos ayudarte?\nPor favor, responde con la letra de la opción sobre la que deseas consultar:\n• A. Requisitos e inscripción a los cursos\n• B. Ver la oferta de cursos disponible\n• C. Anotarse en lista de espera\n• D. Fechas e inicio de cursada\n• E. Información detallada sobre un curso específico\n• F. Buscar cursos en otros Centros de Formación\n• G. Otros (Escribir una consulta personalizada)",
    extractData: "Opcion_Elegida",
    options: [
      { match: "A", nextId: "RESP_A" },
      { match: "B", nextId: "RESP_B" },
      { match: "C", nextId: "RESP_C_1" },
      { match: "D", nextId: "RESP_D" },
      { match: "E", nextId: "RESP_E" },
      { match: "F", nextId: "RESP_F" },
      { match: "G", nextId: "RESP_G_1" },
      { match: "*", nextId: "MSG_INICIAL" } // Vuelve al inicio si es inválida
    ]
  },
  {
    id: "RESP_A",
    text: "Inscripción de cursos, requisitos:\n• Debes traer 1 folio oficio.\n• 2 fotocopias de DNI.\n• 1 fotocopia de título realizado (primario, secundario o superior).\n• Completas una planilla de inscripción acá.\n• A partir del 02/12/26 de 18 a 21 hs comienza la inscripción para el ciclo 2027.",
    options: [
      { match: "*", nextId: "MSG_CIERRE" }
    ]
  },
  {
    id: "RESP_B",
    text: "Hola, podés mirar nuestros cursos acá:\nhttps://aprender.lomasdezamora.gov.ar/courses/academies/centrodeformacionprofesionalcfpndeg412-principal",
    options: [
      { match: "*", nextId: "MSG_CIERRE" }
    ]
  },
  {
    id: "RESP_C_1",
    text: "Para anotarte en la lista de espera, por favor responde a este mensaje con tu Nombre y Apellido:",
    extractData: "Nombre_y_Apellido",
    options: [
      { match: "*", nextId: "RESP_C_2" }
    ]
  },
  {
    id: "RESP_C_2",
    text: "¡Gracias! Ahora, por favor indícanos un número de WhatsApp o email de contacto al que podamos escribirte:",
    extractData: "Telefono_WhatsApp_Email",
    options: [
      { match: "*", nextId: "RESP_C_3" }
    ]
  },
  {
    id: "RESP_C_3",
    text: "Por último, ¿para qué Curso te gustaría anotarte?",
    extractData: "Curso_Interes",
    options: [
      { match: "*", nextId: "RESP_C_FIN" }
    ]
  },
  {
    id: "RESP_C_FIN",
    text: "¡Perfecto! Registramos tus datos. Si se libera una vacante nos comunicaremos con vos. (También puedo ofrecerte el trayecto de CAD: https://abc.gob.ar/formacion_profesional/buscador/1492)",
    options: [
      { match: "*", nextId: "MSG_CIERRE" }
    ]
  },
  {
    id: "RESP_D",
    text: "Comenzó en marzo y es anual. El 02/12/2026 de 18 a 21 hs se realiza la inscripción para el ciclo 2027.",
    options: [
      { match: "*", nextId: "MSG_CIERRE" }
    ]
  },
  {
    id: "RESP_E",
    text: "Hola, te paso información detallada de nuestros cursos:\n• Motos II: https://abc.gob.ar/formacion_profesional/buscador/1489\n• CAD: https://abc.gob.ar/formacion_profesional/buscador/1492\n• Auxiliar Mecánico: https://abc.gob.ar/formacion_profesional/buscador/1497\n• Inyección Diesel: https://abc.gob.ar/formacion_profesional/buscador/1496\n• Electricidad del Automóvil: https://abc.gob.ar/formacion_profesional/buscador/1485\n• Carpintería II: https://abc.gob.ar/formacion_profesional/buscador/1495\n• Organización de Talleres: https://abc.gob.ar/formacion_profesional/buscador/1486\n• Inyección Nafta: https://abc.gob.ar/formacion_profesional/buscador/1487\n• Motos I: https://abc.gob.ar/formacion_profesional/buscador/1488\n• Informática: https://abc.gob.ar/formacion_profesional/buscador/1491\n• CAD II: https://abc.gob.ar/formacion_profesional/buscador/1493",
    options: [
      { match: "*", nextId: "MSG_CIERRE" }
    ]
  },
  {
    id: "RESP_F",
    text: "En este link podés buscar en otro Centro:\nhttps://abc.gob.ar/formacion_profesional/buscador",
    options: [
      { match: "*", nextId: "MSG_CIERRE" }
    ]
  },
  {
    id: "RESP_G_1",
    text: "Para ayudarte con tu consulta personalizada, por favor indícanos tu Nombre y Apellido:",
    extractData: "Nombre_y_Apellido",
    options: [
      { match: "*", nextId: "RESP_G_2" }
    ]
  },
  {
    id: "RESP_G_2",
    text: "¡Gracias! Ahora, por favor indícanos un número de WhatsApp o email de contacto al que podamos escribirte:",
    extractData: "Telefono_WhatsApp_Email",
    options: [
      { match: "*", nextId: "RESP_G_3" }
    ]
  },
  {
    id: "RESP_G_3",
    text: "Por último, escribe a continuación tu consulta o pregunta en un solo mensaje para que podamos ayudarte:",
    extractData: "Consulta_Personalizada",
    options: [
      { match: "*", nextId: "RESP_G_FIN" }
    ]
  },
  {
    id: "RESP_G_FIN",
    text: "¡Muchas gracias! Alguien va a responder a tu pregunta a la brevedad. ¡Saludos!",
    options: [
      { match: "*", nextId: "MSG_CIERRE" }
    ]
  },
  {
    id: "MSG_CIERRE",
    text: "📌 Si necesitas consultar algo más, responde VER MENU para volver al inicio.",
    extractData: "Accion_Reinicio",
    options: [
      { match: "VER MENU", nextId: "MSG_INICIAL" },
      { match: "*", nextId: "MSG_CIERRE" } // Si no dice ver menu, se queda ahi
    ]
  }
];
