-- ==============================================================================
-- SYNAPSIS — ESQUEMA COMPLETO DE POSTGRESQL PARA SUPABASE
-- ==============================================================================
-- Este script crea todas las tablas, índices y políticas de seguridad (RLS)
-- necesarias para ejecutar Synapsis de forma autónoma en Render + Supabase.
-- Ejecuta este script en el SQL Editor de tu panel de Supabase:
-- https://supabase.com/dashboard/project/hbkgtsqeeudpwewopazy/sql
-- ==============================================================================

-- 1. Usuarios (Estudiantes, Docentes, Administradores)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE,
  pass TEXT,
  rol TEXT DEFAULT 'estudiante',
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW(),
  cedula TEXT,
  celular TEXT,
  semestre TEXT,
  codigo TEXT,
  foto TEXT,
  "avatarUrl" TEXT,
  asignaturas JSONB DEFAULT '[]'::jsonb
);

-- 2. Instituciones
CREATE TABLE IF NOT EXISTS public.institutions (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT,
  codigo TEXT,
  ciudad TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Semestres (Consolidados a 9 Semestres Oficiales)
CREATE TABLE IF NOT EXISTS public.semesters (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  inicio TEXT,
  fin TEXT,
  codigo TEXT,
  estado TEXT DEFAULT 'activo',
  nivel TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Asignaturas / Materias
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT,
  "docenteId" TEXT,
  nivel TEXT,
  semestre TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Parciales
CREATE TABLE IF NOT EXISTS public.parciales (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  semestre TEXT,
  asignatura TEXT,
  estado TEXT DEFAULT 'abierto',
  porcentaje NUMERIC DEFAULT 0,
  "fechaInicio" TEXT,
  "fechaFin" TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Exámenes
CREATE TABLE IF NOT EXISTS public.exams (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  materia TEXT,
  "parcialId" TEXT,
  descripcion TEXT,
  "docenteId" TEXT,
  estado TEXT DEFAULT 'activo',
  tiempo NUMERIC DEFAULT 0,
  intentos NUMERIC DEFAULT 0,
  aprobacion NUMERIC DEFAULT 70,
  aleatorio BOOLEAN DEFAULT false,
  "mostrarNota" BOOLEAN DEFAULT true,
  "bannerUrl" TEXT,
  preguntas JSONB DEFAULT '[]'::jsonb,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Entregas y Calificaciones de Exámenes (Submissions)
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  "examenId" TEXT NOT NULL,
  "estudianteId" TEXT NOT NULL,
  "estudianteNombre" TEXT,
  respuestas JSONB DEFAULT '{}'::jsonb,
  puntaje NUMERIC DEFAULT 0,
  aprobado BOOLEAN DEFAULT false,
  correctas NUMERIC DEFAULT 0,
  incorrectas NUMERIC DEFAULT 0,
  "tiempoUsado" TEXT,
  fecha TEXT,
  estado TEXT DEFAULT 'calificado',
  "manualScores" JSONB DEFAULT '{}'::jsonb,
  "manualComments" JSONB DEFAULT '{}'::jsonb,
  "autoPuntaje" NUMERIC,
  "gradedBy" TEXT,
  "gradedAt" TEXT,
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columna actualizado en caso de que la tabla ya existiera previamente
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS actualizado TIMESTAMPTZ DEFAULT NOW();

-- 8. Registro de Calificaciones Finales (GradeRecords / Notas)
CREATE TABLE IF NOT EXISTS public."gradeRecords" (
  id TEXT PRIMARY KEY,
  "estudianteId" TEXT NOT NULL,
  "asignaturaId" TEXT NOT NULL,
  "parcialId" TEXT,
  nota NUMERIC DEFAULT 0,
  aprobado BOOLEAN DEFAULT false,
  comentario TEXT,
  "notaEV1" NUMERIC,
  "notaEV2" NUMERIC,
  "notaTrabajo" NUMERIC,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Trabajos Académicos / Tareas (Assignments)
CREATE TABLE IF NOT EXISTS public.assignments (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  asignatura TEXT,
  semestre TEXT,
  "parcialId" TEXT,
  "fechaEntrega" TEXT,
  tipo TEXT,
  porcentaje NUMERIC,
  valor NUMERIC,
  puntos NUMERIC,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Entregas de Trabajos (AssignmentSubmissions)
CREATE TABLE IF NOT EXISTS public."assignmentSubmissions" (
  id TEXT PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "estudianteId" TEXT NOT NULL,
  "estudianteNombre" TEXT,
  "fechaEntrega" TEXT,
  "archivoNombre" TEXT,
  "archivoUrl" TEXT,
  "comentarioEstudiante" TEXT,
  estado TEXT DEFAULT 'entregado',
  calificacion NUMERIC,
  "comentarioDocente" TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Pagos y Finanzas
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  "estudianteId" TEXT,
  "estudianteNombre" TEXT,
  concepto TEXT,
  monto NUMERIC DEFAULT 0,
  metodo TEXT,
  referencia TEXT,
  fecha TEXT,
  estado TEXT DEFAULT 'completado',
  comprobante TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Estado de Matrícula
CREATE TABLE IF NOT EXISTS public."matriculaStatus" (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'Matriculado',
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Agenda y Calendario de Eventos
CREATE TABLE IF NOT EXISTS public.agenda (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha TEXT,
  hora TEXT,
  tipo TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Artículos Wiki y Recursos de la Comunidad
CREATE TABLE IF NOT EXISTS public."wikiArticles" (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  contenido TEXT,
  categoria TEXT,
  autor TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Asistencia (Attendance)
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  "subjectId" TEXT,
  "studentId" TEXT,
  fecha TEXT,
  estado TEXT,
  creado TIMESTAMPTZ DEFAULT NOW(),
  actualizado TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Registros Eliminados (Para replicación permanente entre dispositivos)
CREATE TABLE IF NOT EXISTS public.deleted_records (
  id TEXT PRIMARY KEY,
  "deletedAt" TIMESTAMPTZ DEFAULT NOW(),
  table_name TEXT
);

-- ==============================================================================
-- SEGURIDAD: ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."gradeRecords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."assignmentSubmissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."matriculaStatus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."wikiArticles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para la aplicación Synapsis (Anon / Authenticated)
DO $$
BEGIN
  -- Crear políticas si no existen
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_users') THEN
    CREATE POLICY "synapsis_all_users" ON public.users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_institutions') THEN
    CREATE POLICY "synapsis_all_institutions" ON public.institutions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_semesters') THEN
    CREATE POLICY "synapsis_all_semesters" ON public.semesters FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_subjects') THEN
    CREATE POLICY "synapsis_all_subjects" ON public.subjects FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_parciales') THEN
    CREATE POLICY "synapsis_all_parciales" ON public.parciales FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_exams') THEN
    CREATE POLICY "synapsis_all_exams" ON public.exams FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_submissions') THEN
    CREATE POLICY "synapsis_all_submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_gradeRecords') THEN
    CREATE POLICY "synapsis_all_gradeRecords" ON public."gradeRecords" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_assignments') THEN
    CREATE POLICY "synapsis_all_assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_assignmentSubmissions') THEN
    CREATE POLICY "synapsis_all_assignmentSubmissions" ON public."assignmentSubmissions" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_payments') THEN
    CREATE POLICY "synapsis_all_payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_matriculaStatus') THEN
    CREATE POLICY "synapsis_all_matriculaStatus" ON public."matriculaStatus" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_agenda') THEN
    CREATE POLICY "synapsis_all_agenda" ON public.agenda FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_wikiArticles') THEN
    CREATE POLICY "synapsis_all_wikiArticles" ON public."wikiArticles" FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_attendance') THEN
    CREATE POLICY "synapsis_all_attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'synapsis_all_deleted_records') THEN
    CREATE POLICY "synapsis_all_deleted_records" ON public.deleted_records FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
