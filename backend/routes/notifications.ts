import { Application, Request, Response } from "express";
import { requireAuth } from "../middleware/sessionAuth";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../services/notificationService";
import { supabaseAdmin } from "../lib/supabaseClient";

const DEFAULT_NOTIFICATION_PREFERENCES = {
  email_new_contacts: true,
  email_follow_up_reminders: true,
  email_weekly_digest: true,
  in_app_new_contacts: true,
  in_app_follow_up_reminders: true,
};

export function registerNotificationRoutes(app: Application) {
  // Get paginated notifications
  app.get("/api/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const [notifications, unreadCount] = await Promise.all([
        getNotifications(userId, limit, offset),
        getUnreadCount(userId),
      ]);

      res.json({ notifications, unreadCount });
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: error.message || "Failed to fetch notifications" });
    }
  });

  // Get unread count only
  app.get("/api/notifications/unread-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const count = await getUnreadCount(userId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: error.message || "Failed to fetch unread count" });
    }
  });

  // Mark single notification as read
  app.patch("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }
      await markAsRead(notificationId, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: error.message || "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      await markAllAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: error.message || "Failed to mark all notifications as read" });
    }
  });

  // Get notification preferences
  app.get("/api/notification-preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;

      const { data, error } = await supabaseAdmin
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      res.json(data || { user_id: userId, ...DEFAULT_NOTIFICATION_PREFERENCES });
    } catch (error: any) {
      console.error("Error fetching notification preferences:", error);
      res.status(500).json({ error: error.message || "Failed to fetch notification preferences" });
    }
  });

  // Update notification preferences
  app.patch("/api/notification-preferences", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;

      const { data, error } = await supabaseAdmin
        .from("user_notification_preferences")
        .upsert(
          { user_id: userId, ...req.body, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json(data);
    } catch (error: any) {
      console.error("Error updating notification preferences:", error);
      res.status(500).json({ error: error.message || "Failed to update notification preferences" });
    }
  });
}
