/**
 * Address Book Service
 * Manages saved contacts and recent recipients for the wallet
 */

export interface Contact {
  id: string;
  address: string;
  name: string;
  label?: string; // e.g., "Work", "Family", "Exchange"
  lastUsed?: Date;
  createdAt: Date;
  isFavorite?: boolean;
}

export interface RecentRecipient {
  address: string;
  lastUsed: Date;
  count: number; // Number of times sent to this address
  lastAmount?: string;
  lastToken?: string;
}

const CONTACTS_STORAGE_KEY = 'arcwallet:address-book';
const RECENT_STORAGE_KEY = 'arcwallet:recent-recipients';
const MAX_RECENT_RECIPIENTS = 10;

// Storage helpers
const getStoredContacts = (): Contact[] => {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return parsed.map((c: any) => ({
      ...c,
      lastUsed: c.lastUsed ? new Date(c.lastUsed) : undefined,
      createdAt: new Date(c.createdAt),
    }));
  } catch {
    return [];
  }
};

const saveContacts = (contacts: Contact[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
};

const getStoredRecents = (): RecentRecipient[] => {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return parsed.map((r: any) => ({
      ...r,
      lastUsed: new Date(r.lastUsed),
    }));
  } catch {
    return [];
  }
};

const saveRecents = (recents: RecentRecipient[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recents));
};

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Address Book Service
export const addressBookService = {
  // Get all contacts
  getContacts(): Contact[] {
    return getStoredContacts().sort((a, b) => {
      // Favorites first, then by last used
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      const aTime = a.lastUsed?.getTime() || 0;
      const bTime = b.lastUsed?.getTime() || 0;
      return bTime - aTime;
    });
  },

  // Get contact by address
  getContactByAddress(address: string): Contact | undefined {
    const contacts = getStoredContacts();
    return contacts.find(c => c.address.toLowerCase() === address.toLowerCase());
  },

  // Add new contact
  addContact(contact: Omit<Contact, 'id' | 'createdAt'>): Contact {
    const contacts = getStoredContacts();

    // Check if address already exists
    const existing = contacts.find(
      c => c.address.toLowerCase() === contact.address.toLowerCase()
    );
    if (existing) {
      throw new Error('Contact with this address already exists');
    }

    const newContact: Contact = {
      ...contact,
      id: generateId(),
      createdAt: new Date(),
    };

    contacts.push(newContact);
    saveContacts(contacts);
    return newContact;
  },

  // Update contact
  updateContact(id: string, updates: Partial<Omit<Contact, 'id' | 'createdAt'>>): Contact | null {
    const contacts = getStoredContacts();
    const index = contacts.findIndex(c => c.id === id);

    if (index === -1) return null;

    contacts[index] = { ...contacts[index], ...updates };
    saveContacts(contacts);
    return contacts[index];
  },

  // Delete contact
  deleteContact(id: string): boolean {
    const contacts = getStoredContacts();
    const filtered = contacts.filter(c => c.id !== id);

    if (filtered.length === contacts.length) return false;

    saveContacts(filtered);
    return true;
  },

  // Toggle favorite
  toggleFavorite(id: string): Contact | null {
    const contacts = getStoredContacts();
    const contact = contacts.find(c => c.id === id);

    if (!contact) return null;

    contact.isFavorite = !contact.isFavorite;
    saveContacts(contacts);
    return contact;
  },

  // Search contacts
  searchContacts(query: string): Contact[] {
    if (!query.trim()) return this.getContacts();

    const lowerQuery = query.toLowerCase();
    return this.getContacts().filter(
      c => c.name.toLowerCase().includes(lowerQuery) ||
           c.address.toLowerCase().includes(lowerQuery) ||
           c.label?.toLowerCase().includes(lowerQuery)
    );
  },

  // Get recent recipients
  getRecentRecipients(): RecentRecipient[] {
    return getStoredRecents()
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, MAX_RECENT_RECIPIENTS);
  },

  // Add/update recent recipient (called after successful transaction)
  recordRecipient(address: string, amount?: string, token?: string): void {
    const recents = getStoredRecents();
    const existing = recents.find(
      r => r.address.toLowerCase() === address.toLowerCase()
    );

    if (existing) {
      existing.lastUsed = new Date();
      existing.count += 1;
      existing.lastAmount = amount;
      existing.lastToken = token;
    } else {
      recents.push({
        address,
        lastUsed: new Date(),
        count: 1,
        lastAmount: amount,
        lastToken: token,
      });
    }

    // Keep only max recent recipients
    const sorted = recents
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, MAX_RECENT_RECIPIENTS);

    saveRecents(sorted);

    // Also update lastUsed on contact if exists
    const contacts = getStoredContacts();
    const contact = contacts.find(
      c => c.address.toLowerCase() === address.toLowerCase()
    );
    if (contact) {
      contact.lastUsed = new Date();
      saveContacts(contacts);
    }
  },

  // Clear recent recipients
  clearRecentRecipients(): void {
    saveRecents([]);
  },

  // Get combined list (contacts + recents without duplicates)
  getCombinedList(): Array<{
    address: string;
    name?: string;
    label?: string;
    isContact: boolean;
    isFavorite: boolean;
    lastUsed?: Date;
    count?: number;
  }> {
    const contacts = this.getContacts();
    const recents = this.getRecentRecipients();
    const result: Array<{
      address: string;
      name?: string;
      label?: string;
      isContact: boolean;
      isFavorite: boolean;
      lastUsed?: Date;
      count?: number;
    }> = [];

    // Add all contacts first
    contacts.forEach(c => {
      result.push({
        address: c.address,
        name: c.name,
        label: c.label,
        isContact: true,
        isFavorite: c.isFavorite || false,
        lastUsed: c.lastUsed,
      });
    });

    // Add recents that aren't already contacts
    recents.forEach(r => {
      const exists = result.find(
        item => item.address.toLowerCase() === r.address.toLowerCase()
      );
      if (!exists) {
        result.push({
          address: r.address,
          isContact: false,
          isFavorite: false,
          lastUsed: r.lastUsed,
          count: r.count,
        });
      }
    });

    return result.sort((a, b) => {
      // Favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      // Then contacts
      if (a.isContact && !b.isContact) return -1;
      if (!a.isContact && b.isContact) return 1;
      // Then by last used
      const aTime = a.lastUsed?.getTime() || 0;
      const bTime = b.lastUsed?.getTime() || 0;
      return bTime - aTime;
    });
  },

  // Export contacts (for backup)
  exportContacts(): string {
    return JSON.stringify(getStoredContacts(), null, 2);
  },

  // Import contacts (from backup)
  importContacts(data: string): number {
    try {
      const imported = JSON.parse(data) as Contact[];
      const existing = getStoredContacts();
      let added = 0;

      imported.forEach(contact => {
        const exists = existing.find(
          c => c.address.toLowerCase() === contact.address.toLowerCase()
        );
        if (!exists) {
          existing.push({
            ...contact,
            id: generateId(),
            createdAt: new Date(contact.createdAt),
            lastUsed: contact.lastUsed ? new Date(contact.lastUsed) : undefined,
          });
          added++;
        }
      });

      saveContacts(existing);
      return added;
    } catch {
      throw new Error('Invalid import data');
    }
  },
};

export default addressBookService;
