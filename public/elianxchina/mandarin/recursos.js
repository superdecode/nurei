/* ============================================================
   BAÚL DE RECURSOS — Elian x China
   ------------------------------------------------------------
   Para agregar un recurso: copia un bloque y edítalo.

   categoria : "tonos" | "caracteres" | "vocabulario" | "gramatica"
               | "oido" | "lectura" | "diccionario" | "practica" | "libros"
   costo     : "gratis" | "freemium" | "pago"
   idioma    : "es" | "en" | "zh"
   momento   : "dia1" | "semanas" | "despues"
   destacado : true  -> aparece con marca de recomendado
   ============================================================ */

const RECURSOS = [

  /* ---------- TONOS Y PINYIN ---------- */
  {
    nombre: "Tabla de pinyin de Yabla",
    url: "https://chinese.yabla.com/chinese-pinyin-chart.php",
    categoria: "tonos",
    costo: "gratis",
    idioma: "en",
    momento: "dia1",
    destacado: true,
    que: "Todas las sílabas del chino con audio real en los cuatro tonos.",
    porque: "Es la herramienta que más uso cuando alguien me pregunta cómo suena algo. Haces clic y lo escuchas. No hay nada mejor y es gratis."
  },
  {
    nombre: "Chinese Pronunciation Wiki — AllSet Learning",
    url: "https://resources.allsetlearning.com/chinese/pronunciation/",
    categoria: "tonos",
    costo: "gratis",
    idioma: "en",
    momento: "dia1",
    que: "Explicación técnica de cada sonido del mandarín, sonido por sonido.",
    porque: "Cuando un sonido no te sale y no entiendes por qué, aquí está la respuesta. Sirve para consultar, no para leer de corrido."
  },
  {
    nombre: "Hacking Chinese",
    url: "https://www.hackingchinese.com/",
    categoria: "tonos",
    costo: "gratis",
    idioma: "en",
    momento: "semanas",
    que: "Artículos sobre cómo estudiar chino, con mucho material sobre tonos.",
    porque: "No enseña chino, enseña a estudiar chino. Los artículos sobre tonos son los mejores que hay en internet."
  },

  /* ---------- CARACTERES ---------- */
  {
    nombre: "Dong Chinese",
    url: "https://www.dong-chinese.com/",
    categoria: "caracteres",
    costo: "freemium",
    idioma: "en",
    momento: "semanas",
    destacado: true,
    que: "Muestra de dónde viene cada carácter y en qué partes se descompone.",
    porque: "El momento en que entiendes que los caracteres no son dibujos aleatorios sino piezas que se repiten, todo cambia. Esta página provoca ese momento."
  },
  {
    nombre: "HanziCraft",
    url: "https://hanzicraft.com/",
    categoria: "caracteres",
    costo: "gratis",
    idioma: "en",
    momento: "semanas",
    que: "Pegas un carácter y te lo desarma en sus componentes.",
    porque: "Feo pero rapidísimo. Para cuando ves un carácter y quieres saber qué tiene adentro."
  },
  {
    nombre: "Hanzi Writer",
    url: "https://hanziwriter.org/",
    categoria: "caracteres",
    costo: "gratis",
    idioma: "en",
    momento: "semanas",
    que: "Animación del orden de trazos de cualquier carácter.",
    porque: "El orden de los trazos importa más de lo que parece: es lo que te permite buscar un carácter que no conoces y escribir a mano velocidad normal."
  },
  {
    nombre: "Skritter",
    url: "https://skritter.com/",
    categoria: "caracteres",
    costo: "pago",
    idioma: "en",
    momento: "despues",
    que: "App para practicar escritura a mano con repetición espaciada.",
    porque: "Excelente, pero no la toques hasta que ya reconozcas unos 100 caracteres. Antes de eso es dinero desperdiciado."
  },

  /* ---------- VOCABULARIO ---------- */
  {
    nombre: "Anki",
    url: "https://apps.ankiweb.net/",
    categoria: "vocabulario",
    costo: "gratis",
    idioma: "es",
    momento: "semanas",
    destacado: true,
    que: "Tarjetas de memoria con repetición espaciada. Gratis en todo menos iPhone.",
    porque: "Es feo, es incómodo los primeros días, y es la única razón por la que hay gente que retiene 2000 caracteres. Nada lo reemplaza."
  },
  {
    nombre: "Mazos compartidos de Anki",
    url: "https://ankiweb.net/shared/decks",
    categoria: "vocabulario",
    costo: "gratis",
    idioma: "en",
    momento: "semanas",
    que: "Mazos ya armados por otros estudiantes, incluidos los del HSK.",
    porque: "No armes tu propio mazo desde cero al principio. Descarga uno de HSK 1 y ajústalo cuando ya sepas qué te sirve."
  },

  /* ---------- GRAMÁTICA ---------- */
  {
    nombre: "Chinese Grammar Wiki",
    url: "https://resources.allsetlearning.com/chinese/grammar/",
    categoria: "gramatica",
    costo: "gratis",
    idioma: "en",
    momento: "semanas",
    destacado: true,
    que: "Toda la gramática del chino organizada por nivel, con ejemplos.",
    porque: "El mejor recurso gratuito de chino que existe, en cualquier idioma. Cuando no entiendas una estructura, la respuesta está acá."
  },

  /* ---------- OÍDO ---------- */
  {
    nombre: "Comprehensible Chinese (YouTube)",
    url: "https://www.youtube.com/@ComprehensibleChinese",
    categoria: "oido",
    costo: "gratis",
    idioma: "zh",
    momento: "semanas",
    destacado: true,
    que: "Videos hablados en chino lento, con dibujos y gestos, sin traducción.",
    porque: "Vas a entender más de lo que crees desde el primer video. Es la forma más natural de acostumbrar el oído y no cuesta nada."
  },
  {
    nombre: "Lazy Chinese (YouTube)",
    url: "https://www.youtube.com/@LazyChinese",
    categoria: "oido",
    costo: "gratis",
    idioma: "zh",
    momento: "semanas",
    que: "Historias y conversaciones en chino sencillo con subtítulos.",
    porque: "Buena escalera: empiezas con los videos de principiante y subes sin darte cuenta."
  },
  {
    nombre: "TeaTime Chinese",
    url: "https://teatimechinese.com/",
    categoria: "oido",
    costo: "gratis",
    idioma: "zh",
    momento: "despues",
    que: "Podcast en chino intermedio sobre cultura y vida cotidiana.",
    porque: "Para cuando ya aguantes escuchar chino corrido. Antes te va a frustrar."
  },
  {
    nombre: "Coffee Break Chinese",
    url: "https://coffeebreaklanguages.com/coffeebreakchinese/",
    categoria: "oido",
    costo: "gratis",
    idioma: "en",
    momento: "dia1",
    que: "Podcast donde un profesor le enseña a un estudiante desde cero.",
    porque: "Escuchas a alguien equivocarse igual que tú. Eso ayuda más de lo que parece cuando vas empezando."
  },
  {
    nombre: "Mandarin Corner",
    url: "https://mandarincorner.org/",
    categoria: "oido",
    costo: "gratis",
    idioma: "zh",
    momento: "despues",
    que: "Entrevistas en la calle en China con transcripción completa.",
    porque: "Chino real, de gente real, sin guion. Es lo más parecido a estar allá."
  },

  /* ---------- LECTURA ---------- */
  {
    nombre: "Mandarin Bean",
    url: "https://mandarinbean.com/",
    categoria: "lectura",
    costo: "gratis",
    idioma: "zh",
    momento: "despues",
    que: "Lecturas graduadas por nivel HSK con audio y vocabulario.",
    porque: "Gratis y bien hecho. La alternativa de pago no vale la diferencia cuando estás empezando."
  },
  {
    nombre: "Du Chinese",
    url: "https://www.duchinese.net/",
    categoria: "lectura",
    costo: "freemium",
    idioma: "zh",
    momento: "despues",
    que: "App de lecturas graduadas: tocas una palabra y te da la traducción.",
    porque: "La versión gratis da lecturas nuevas cada semana. Alcanza perfectamente para el primer año."
  },
  {
    nombre: "Heavenly Path",
    url: "https://heavenlypath.notion.site/",
    categoria: "lectura",
    costo: "gratis",
    idioma: "en",
    momento: "despues",
    que: "Guía enorme sobre qué leer en chino según tu nivel real.",
    porque: "Cuando llegues al punto de querer leer algo de verdad, esta guía te ahorra un año de elegir mal."
  },

  /* ---------- DICCIONARIO ---------- */
  {
    nombre: "Pleco",
    url: "https://www.pleco.com/",
    categoria: "diccionario",
    costo: "freemium",
    idioma: "en",
    momento: "dia1",
    destacado: true,
    que: "Diccionario de chino para el celular. Escribes el carácter con el dedo o lo apuntas con la cámara.",
    porque: "Instálalo hoy aunque no sepas nada. Todo el que estudia chino en serio lo tiene. La versión gratis alcanza para años."
  },
  {
    nombre: "MDBG",
    url: "https://www.mdbg.net/chinese/dictionary",
    categoria: "diccionario",
    costo: "gratis",
    idioma: "en",
    momento: "dia1",
    que: "Diccionario chino-inglés en el navegador.",
    porque: "Para cuando estás en la computadora y no quieres sacar el celular."
  },
  {
    nombre: "Purple Culture",
    url: "https://www.purpleculture.net/",
    categoria: "diccionario",
    costo: "gratis",
    idioma: "en",
    momento: "semanas",
    que: "Convierte texto chino a pinyin y genera hojas de práctica de trazos.",
    porque: "El generador de hojas para imprimir es lo más útil que tiene. Sirve si quieres practicar escritura en papel."
  },

  /* ---------- PRÁCTICA CON PERSONAS ---------- */
  {
    nombre: "HelloTalk",
    url: "https://www.hellotalk.com/",
    categoria: "practica",
    costo: "freemium",
    idioma: "es",
    momento: "semanas",
    destacado: true,
    que: "Intercambio de idiomas: tú enseñas español, alguien te enseña chino.",
    porque: "Hay muchísimo chino queriendo aprender español y poca oferta. Estás en una posición de ventaja para conseguir intercambio."
  },
  {
    nombre: "Tandem",
    url: "https://www.tandem.net/",
    categoria: "practica",
    costo: "freemium",
    idioma: "es",
    momento: "semanas",
    que: "Lo mismo que HelloTalk, con otra comunidad.",
    porque: "Si en una no encuentras a alguien con quien fluya la conversación, prueba la otra."
  },
  {
    nombre: "italki",
    url: "https://www.italki.com/",
    categoria: "practica",
    costo: "pago",
    idioma: "es",
    momento: "despues",
    que: "Clases uno a uno con profesores chinos, por hora.",
    porque: "Hay profesores que hablan español. Vale la pena cuando ya tengas base: antes, la clase se te va en explicarte cosas que están gratis en internet."
  },

  /* ---------- EN ESPAÑOL ---------- */
  {
    nombre: "Chinesimple (Khanji School)",
    url: "https://khanjischool.com/es/",
    categoria: "vocabulario",
    costo: "freemium",
    idioma: "es",
    momento: "dia1",
    destacado: true,
    que: "App y blog de chino en español, con material organizado por nivel HSK.",
    porque: "De lo poco decente que hay en español. Si el inglés te frena, empieza por acá."
  },
  {
    nombre: "Mucho Más que Nihao",
    url: "https://muchomasquenihao.com/",
    categoria: "caracteres",
    costo: "gratis",
    idioma: "es",
    momento: "semanas",
    que: "Blog en español con flashcards y animaciones de trazos descargables.",
    porque: "Material en español hecho por alguien que sabe. Las hojas de trazos son gratis y están bien."
  },
  {
    nombre: "Instituto Confucio de Madrid",
    url: "https://confuciomadrid.es/",
    categoria: "libros",
    costo: "gratis",
    idioma: "es",
    momento: "despues",
    que: "Información oficial sobre el examen HSK en español, con exámenes de muestra.",
    porque: "Si algún día quieres certificarte, aquí está la información sin intermediarios."
  },
  {
    nombre: "Chinese Testing International (sitio oficial)",
    url: "https://www.chinesetest.cn/",
    categoria: "libros",
    costo: "gratis",
    idioma: "en",
    momento: "despues",
    que: "Sitio oficial del HSK: listas de vocabulario, exámenes de muestra, inscripciones.",
    porque: "La fuente. Todo lo demás que leas sobre el HSK sale de aquí."
  },

  /* ---------- LIBROS ---------- */
  {
    nombre: "HSK Standard Course 1 — edición 2026",
    url: "",
    categoria: "libros",
    costo: "pago",
    idioma: "zh",
    momento: "semanas",
    destacado: true,
    que: "El manual estándar del primer nivel, con audio y cuaderno de ejercicios.",
    porque: "Si compras un solo libro, que sea este. Ojo: pide la edición 2026, la anterior quedó desactualizada por el cambio de programa."
  },
  {
    nombre: "Integrated Chinese",
    url: "",
    categoria: "libros",
    costo: "pago",
    idioma: "en",
    momento: "despues",
    que: "El manual que usan la mayoría de las universidades en Estados Unidos.",
    porque: "Más denso y más caro que el HSK Standard Course. Solo si vas a estudiar chino de forma académica."
  }

];

/* ============================================================
   TODAVÍA NO USES ESTO
   Recursos buenos, pero no ahora. Saber cuándo algo NO te sirve
   ahorra más tiempo que cualquier app.
   ============================================================ */

const TODAVIA_NO = [
  {
    nombre: "Cursos de caligrafía con pincel",
    razon: "Es arte, no es idioma. Precioso, pero no te acerca ni un día a hablar chino."
  },
  {
    nombre: "Aprender chino tradicional al mismo tiempo",
    razon: "Empieza por simplificado. Cuando tengas base, pasar a tradicional te toma semanas, no años."
  },
  {
    nombre: "Memorizar los 214 radicales de corrido",
    razon: "Los vas a aprender solos, apareciendo dentro de caracteres reales. Memorizarlos en lista es aburrido y no se pega."
  },
  {
    nombre: "Series y películas chinas sin subtítulos",
    razon: "En el primer año no vas a entender casi nada y solo te va a desanimar. Guárdalas para más adelante."
  },
  {
    nombre: "Libros de HSK 3 en adelante",
    razon: "Comprarlos ahora es comprar culpa. Uno a la vez."
  }
];
