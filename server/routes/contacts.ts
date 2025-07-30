import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";
import { storage } from "../storage";

export function registerContactRoutes(app: Express) {
  // Get all contacts for authenticated user
  app.get("/api/contacts/all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contacts = await storage.getAllUserContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching all contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  // Update contact
  app.patch("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactId = parseInt(req.params.id);
      const updates = req.body;

      const contact = await storage.updateContact(contactId, userId, updates);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  // Generate message for contact
  app.post("/api/contacts/:id/generate-message", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactId = parseInt(req.params.id);
      const { messageType, tone } = req.body;

      const result = await storage.generateContactMessage(contactId, userId, messageType, tone);
      if (!result) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error generating message:", error);
      res.status(500).json({ message: "Failed to generate message" });
    }
  });
}