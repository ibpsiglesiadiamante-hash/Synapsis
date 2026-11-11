/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Exam } from '../types';
import { uid, now } from './db';

/**
 * Biblioteca canónica de citas bíblicas institucionales (IBPS) según la materia
 */
export const BIBLICAL_VERSES_BY_SUBJECT: Record<string, string> = {
  // Educación Cristiana
  educacion_cristiana: '“Id, y haced discípulos a todas las naciones, bautizándoles en el nombre del Padre, y del Hijo y del Espíritu Santo; enseñándoles que guarden todas las cosas que os he mandado...” (Mateo 28:19,20)',
  
  // Administración
  administracion: '“Ahora bien, se requiere de los administradores, que cada uno sea hallado fiel”. 1 Corintios 4:2',
  
  // Antiguo Testamento
  introduccion_antiguo_testamento: '“Debes comprometerte con todo tu ser a cumplir cada uno de estos mandatos que hoy te entrego” Deuteronomio 6:6',
  antiguo_testamento: '““Mas alábese en esto el que se hubiere de alabar: en entenderme y conocerme, que yo soy Jehová, que hago misericordia, juicio y justicia” Jeremías 9:24',
  
  // Nuevo Testamento
  introduccion_nuevo_testamento: '“A lo suyo vino, y los suyos no le recibieron. Mas a todos los que le recibieron, a los que creen en su nombre, les dio potestad de ser hechos hijos de Dios” Juan 1:11-12',
  nuevo_testamento: '“El cielo y la tierra pasarán, pero mis palabras no pasarán” Mateo 24:35',
  
  // Pentateuco
  pentateuco: '“Oye, Israel: Jehová nuestro Dios, Jehová uno es” Deuteronomio 6:4',
  
  // Teología
  teologia: '“Toda la Escritura está inspirada por Dios y es provechosa para enseñar, para reprender, para corregir, para entrenar en justicia” 2 Timoteo 3:16',
  
  // Profetas Mayores
  profetas_mayores: '“Porque un niño nos ha nacido, un hijo nos ha sido dado, y la soberanía reposará sobre sus hombros. Y se llamará su nombre Admirable Consejero, Dios Poderoso, Padre Eterno, Príncipe de Paz” Isaías 9:6',
  
  // Profetas Menores
  profetas_menores: '“Clama a mí, y yo te responderé, y te enseñaré cosas grandes y ocultas que tú no conoces” Jeremías 33:3',
  
  // Geografía Bíblica
  geografia_biblica: '“Porque Jehová tu Dios te introduce en la buena tierra, tierra de arroyos, de aguas, de fuentes y de manantiales, que brotan en vegas y montes” Deuteronomio 8:7',
  
  // Apocalipsis
  apocalipsis: '“El séptimo ángel tocó la trompeta, y hubo grandes voces en el cielo, que decían: Los reinos del mundo han venido a ser de nuestro Señor y de su Cristo; y él reinará por los siglos de los siglos” Apocalipsis 11:15',
  
  // Doctrina del Hombre, Pecado y Salvación
  doctrina_hombre_pecado_salvacion: '“Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.” Juan 3:16',
  
  // Homilética
  homiletica: '“Procura con diligencia presentarte a Dios aprobado, como obrero que no tiene de qué avergonzarse, que usa bien la palabra de verdad.” 2 Timoteo 2:15',
  
  // Libros Históricos
  libros_historicos: '“Lámpara es a mis pies tu palabra, y lumbrera a mi camino.” Salmo 119:105',
  
  // Misiones
  misiones: '“Y les dijo: Id por todo el mundo y predicad el evangelio a toda criatura.” Marcos 16:15',
  
  // Hermenéutica
  hermeneutica: '“Escudriñad las Escrituras; porque a vosotros os parece que en ellas tenéis la vida eterna; y ellas son las que dan testimonio de mí.” Juan 5:39',
  
  // Epístolas Paulinas / Generales
  epistolas_paulinas: '“Porque no me avergüenzo del evangelio, porque es poder de Dios para salvación a todo aquel que cree” Romanos 1:16',
  epistolas_generales: '“Pero sed hacedores de la palabra, y no tan solamente oidores, engañándoos a vosotros mismos.” Santiago 1:22',
  
  // Ética e Integridad
  etica_integridad: '“El que camina en integridad anda confiado; mas el que pervierte sus caminos será quebrantado.” Proverbios 10:9',
  
  // Consejería
  consejeria: '“Donde no hay dirección sabia, caerá el pueblo; mas en la multitud de consejeros hay seguridad.” Proverbios 11:14',
  
  // Controversia
  controversia: '“Amados, por la gran solicitud que tenía de escribiros acerca de nuestra común salvación, me ha sido necesario escribiros exhortándoos que contendáis ardientemente por la fe” Judas 1:3',
  
  // Iglecrecimiento
  iglecrecimiento: '“Y el Señor añadía cada día a la iglesia los que habían de ser salvos.” Hechos 2:47',
  
  // Angelología
  angelologia: '“¿No son todos espíritus ministradores, enviados para servicio a favor de los que serán herederos de la salvación?” Hebreos 1:14',
  
  // Historia de la Iglesia
  historia_iglesia: '“Y yo también te digo, que tú eres Pedro, y sobre esta roca edificaré mi iglesia; y las puertas del Hades no prevalecerán contra ella.” Mateo 16:18',
  
  // Libros Poéticos
  libros_poeticos: '“El principio de la sabiduría es el temor de Jehová; los insensatos desprecian la sabiduría y la enseñanza.” Proverbios 1:7',
  
  // Cristología
  cristologia: '“Él es la imagen del Dios invisible, el primogénito de toda creación.” Colosenses 1:15',
  
  // Espíritu Santo
  espiritu_santo: '“Pero recibiréis poder, cuando haya venido sobre vosotros el Espíritu Santo, y me seréis testigos en Jerusalén, en toda Judea, en Samaria, y hasta lo último de la tierra.” Hechos 1:8'
};

export const DEFAULT_INSTITUTIONAL_VERSE = '“Toda la Escritura está inspirada por Dios y es provechosa para enseñar, para reprender, para corregir, para entrenar en justicia” (2 Timoteo 3:16)';

/**
 * Normaliza el nombre de la materia para buscar su cita bíblica correspondiente
 */
export function getBibleVerseForSubject(subjectName?: string): string {
  if (!subjectName) return DEFAULT_INSTITUTIONAL_VERSE;
  
  const norm = subjectName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (norm.includes('educacion')) return BIBLICAL_VERSES_BY_SUBJECT.educacion_cristiana;
  if (norm.includes('administracion')) return BIBLICAL_VERSES_BY_SUBJECT.administracion;
  if (norm.includes('antiguo') || norm.includes(' a.t') || norm.includes(' at')) return BIBLICAL_VERSES_BY_SUBJECT.introduccion_antiguo_testamento;
  if (norm.includes('nuevo') || norm.includes(' n.t') || norm.includes(' nt')) return BIBLICAL_VERSES_BY_SUBJECT.introduccion_nuevo_testamento;
  if (norm.includes('pentateuco')) return BIBLICAL_VERSES_BY_SUBJECT.pentateuco;
  if (norm.includes('teologia')) return BIBLICAL_VERSES_BY_SUBJECT.teologia;
  if (norm.includes('profetas mayores')) return BIBLICAL_VERSES_BY_SUBJECT.profetas_mayores;
  if (norm.includes('profetas menores') || norm.includes('profetas')) return BIBLICAL_VERSES_BY_SUBJECT.profetas_menores;
  if (norm.includes('geografia')) return BIBLICAL_VERSES_BY_SUBJECT.geografia_biblica;
  if (norm.includes('apocalipsis')) return BIBLICAL_VERSES_BY_SUBJECT.apocalipsis;
  if (norm.includes('doctrina') || norm.includes('hombre') || norm.includes('salvacion')) return BIBLICAL_VERSES_BY_SUBJECT.doctrina_hombre_pecado_salvacion;
  if (norm.includes('homiletica')) return BIBLICAL_VERSES_BY_SUBJECT.homiletica;
  if (norm.includes('historico')) return BIBLICAL_VERSES_BY_SUBJECT.libros_historicos;
  if (norm.includes('mision')) return BIBLICAL_VERSES_BY_SUBJECT.misiones;
  if (norm.includes('hermeneutica')) return BIBLICAL_VERSES_BY_SUBJECT.hermeneutica;
  if (norm.includes('paulinas')) return BIBLICAL_VERSES_BY_SUBJECT.epistolas_paulinas;
  if (norm.includes('epistolas')) return BIBLICAL_VERSES_BY_SUBJECT.epistolas_generales;
  if (norm.includes('etica')) return BIBLICAL_VERSES_BY_SUBJECT.etica_integridad;
  if (norm.includes('consejeria')) return BIBLICAL_VERSES_BY_SUBJECT.consejeria;
  if (norm.includes('controversia')) return BIBLICAL_VERSES_BY_SUBJECT.controversia;
  if (norm.includes('iglecrecimiento')) return BIBLICAL_VERSES_BY_SUBJECT.iglecrecimiento;
  if (norm.includes('angelologia')) return BIBLICAL_VERSES_BY_SUBJECT.angelologia;
  if (norm.includes('historia')) return BIBLICAL_VERSES_BY_SUBJECT.historia_iglesia;
  if (norm.includes('poeticos')) return BIBLICAL_VERSES_BY_SUBJECT.libros_poeticos;
  if (norm.includes('cristologia')) return BIBLICAL_VERSES_BY_SUBJECT.cristologia;
  if (norm.includes('espiritu')) return BIBLICAL_VERSES_BY_SUBJECT.espiritu_santo;

  return DEFAULT_INSTITUTIONAL_VERSE;
}

/**
 * Genera el título estándar de 2 líneas oficial del IBPS:
 * Línea 1: Examen de {Materia}
 * Línea 2: {Parcial / Evaluación} - IBPS
 */
export function getDefaultExamTitle(subjectName?: string, parcialName?: string, institutionCode: string = 'IBPS'): string {
  const cleanMateria = (subjectName || '').trim() || 'Asignatura';
  
  // Normalizar nombre del parcial (ej. "Evaluacion II", "Evaluación I", "Parcial 1")
  let cleanParcial = (parcialName || '').trim();
  if (!cleanParcial) {
    cleanParcial = 'Evaluación I';
  } else if (!cleanParcial.toLowerCase().startsWith('evaluaci') && !cleanParcial.toLowerCase().startsWith('parcial')) {
    cleanParcial = `Evaluación ${cleanParcial}`;
  }

  // Si el parcial ya contiene la sigla IBPS, no duplicarla
  const suffix = cleanParcial.toUpperCase().includes(institutionCode.toUpperCase())
    ? cleanParcial
    : `${cleanParcial} - ${institutionCode}`;

  return `Examen de ${cleanMateria}\n${suffix}`;
}

export interface DefaultExamParams {
  materia: string;
  parcialId?: string | null;
  parcialNombre?: string;
  semestre?: string;
  docenteId?: string;
  tiempo?: number;
  intentos?: number;
  aprobacion?: number;
  bannerUrl?: string;
}

/**
 * Crea un objeto Exam con toda la información y formato predeterminados estándar de IBPS
 */
export function createDefaultExamObject(params: DefaultExamParams): Exam {
  const cleanMateria = params.materia.trim();
  const titulo = getDefaultExamTitle(cleanMateria, params.parcialNombre);
  const subtitulo = getBibleVerseForSubject(cleanMateria);

  return {
    id: uid(),
    titulo,
    subtitulo,
    materia: cleanMateria,
    parcialId: params.parcialId || null,
    semestre: params.semestre || 'Semestre I',
    descripcion: '',
    docenteId: params.docenteId || 'u-admin',
    estado: 'borrador',
    tiempo: params.tiempo ?? 60,
    intentos: params.intentos ?? 1,
    aprobacion: params.aprobacion ?? 60,
    aleatorio: false,
    mostrarNota: true,
    creado: now(),
    preguntas: [],
    bannerUrl: params.bannerUrl || 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=1200&q=80',
  };
}
