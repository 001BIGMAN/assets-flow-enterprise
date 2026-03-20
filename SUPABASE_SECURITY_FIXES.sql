-- ========================================================
-- SUPABASE SECURITY ADVISOR FIXES
-- ========================================================
-- Run these commands in your Supabase SQL Editor to resolve 
-- the issues flagged by the Security Advisor.

-- 1. FIX ERRORS: student_profiles View
ALTER VIEW IF EXISTS public.student_profiles SET (security_invoker = true);

-- 2. FIX WARNING: Function Search Path
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_notification_email') THEN
        ALTER FUNCTION public.send_notification_email() SET search_path = public;
    END IF;
END $$;

-- 3. FIX WARNING: Extension in Public Schema
-- NOTE: Moving extensions like 'pg_net' to a custom schema is often
-- restricted in managed Supabase environments. Skipping move to avoid errors.
CREATE SCHEMA IF NOT EXISTS extensions;

-- 4. FIX INFO: Row Level Security (RLS) Policies
-- The advisor noted RLS is enabled but no policies exist for these tables.
-- This means all access is currently denied by default.

-- For "Profiles" table
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Profiles') THEN
        ALTER TABLE public."Profiles" ENABLE ROW LEVEL SECURITY;
        
        -- Users can view/update own profile
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Profiles' AND policyname = 'Users can view own profile') THEN
            CREATE POLICY "Users can view own profile" ON public."Profiles" FOR SELECT USING (auth.uid() = id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Profiles' AND policyname = 'Users can update own profile') THEN
            CREATE POLICY "Users can update own profile" ON public."Profiles" FOR UPDATE USING (auth.uid() = id);
        END IF;

        -- Admins can view/update ALL profiles
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'Profiles' AND policyname = 'Admins can manage all profiles') THEN
            CREATE POLICY "Admins can manage all profiles" ON public."Profiles" FOR ALL 
            USING ( (SELECT role FROM public."Profiles" WHERE id = auth.uid()) = 'admin' );
        END IF;
    END IF;
END $$;

-- For "profiles" (lowercase version)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;

        -- Users can view/update own profile
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile_lc') THEN
            CREATE POLICY "Users can view own profile_lc" ON public."profiles" FOR SELECT USING (auth.uid() = id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile_lc') THEN
            CREATE POLICY "Users can update own profile_lc" ON public."profiles" FOR UPDATE USING (auth.uid() = id);
        END IF;

        -- Admins can view/update ALL profiles
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can manage all profiles_lc') THEN
            CREATE POLICY "Admins can manage all profiles_lc" ON public."profiles" FOR ALL 
            USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );
        END IF;
    END IF;
END $$;

-- 5. FIX ACCESS: Notifications, Audio, and Messages
-- Ensure admins can manage these tables and students can view them.

-- For "notifications"
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Anyone can view notifications" ON public.notifications;
        CREATE POLICY "Anyone can view notifications" ON public.notifications FOR SELECT USING (true);
        DROP POLICY IF EXISTS "Admins can manage notifications" ON public.notifications;
        CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL 
        USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );
    END IF;
END $$;

-- For "audio_recordings"
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audio_recordings') THEN
        ALTER TABLE public.audio_recordings ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Anyone can view recordings" ON public.audio_recordings;
        CREATE POLICY "Anyone can view recordings" ON public.audio_recordings FOR SELECT USING (true);
        DROP POLICY IF EXISTS "Admins can manage recordings" ON public.audio_recordings;
        CREATE POLICY "Admins can manage recordings" ON public.audio_recordings FOR ALL 
        USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );
    END IF;
END $$;

-- For "admin_messages" (The Chat)
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_messages') THEN
        ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
        -- Only admins can see/send messages
        DROP POLICY IF EXISTS "Admins can manage team chat" ON public.admin_messages;
        CREATE POLICY "Admins can manage team chat" ON public.admin_messages FOR ALL 
        USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );
    END IF;
END $$;

-- ========================================================
-- MANUAL ACTION REQUIRED IN SUPABASE DASHBOARD:
-- ========================================================
-- 1. Leaked Password Protection:
--    Go to: Authentication -> Settings -> Security (at the bottom)
--    Enable: "Leaked password protection"
-- ========================================================
