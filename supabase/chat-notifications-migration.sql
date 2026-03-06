-- Migration to add Chat Notifications Logic

-- 1. Create the function that will be triggered when a new message is inserted
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
    v_project_title TEXT;
    v_member RECORD;
    v_existing_notification UUID;
BEGIN
    -- Get the project ID related to this channel
    SELECT project_id INTO v_project_id
    FROM public.channels
    WHERE id = NEW.channel_id;

    -- Exit if no project found
    IF v_project_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the project title for the notification message
    SELECT title INTO v_project_title
    FROM public.projects
    WHERE id = v_project_id;

    -- Loop through all team members of this project EXCEPT the sender
    FOR v_member IN 
        SELECT user_id 
        FROM public.team_members 
        WHERE project_id = v_project_id 
        AND user_id != NEW.user_id
    LOOP
        -- Anti-spam: Check if this user ALREADY has an UNREAD chat notification for this project
        SELECT id INTO v_existing_notification
        FROM public.notifications
        WHERE user_id = v_member.user_id
          AND type = 'new_chat_message'
          AND read = false
          AND link LIKE '%chat.html?project=' || v_project_id || '%'
        LIMIT 1;

        -- If they DO NOT have an existing unread notification, create one
        IF v_existing_notification IS NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                link
            ) VALUES (
                v_member.user_id,
                'New chat messages',
                'You have unread messages in ' || v_project_title,
                'new_chat_message',
                'chat.html?project=' || v_project_id
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Create the trigger on the messages table
DROP TRIGGER IF EXISTS on_message_created_notify ON public.messages;
CREATE TRIGGER on_message_created_notify
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_chat_message();
