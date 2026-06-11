import React, { useState, useEffect } from "react";
import {
  Mail,
  Send,
  Inbox,
  Trash2,
  ArrowRight,
  User,
  Hash,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export function MessagingManager() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({
    recipient_email: "",
    recipient_name: "",
    subject: "",
    body: "",
  });

  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (id: string) => {
    if (
      !window.confirm(
        "Êtes-vous sûr de vouloir supprimer ce message de l'historique ?",
      )
    )
      return;
    try {
      await apiFetch(`/api/messages/${id}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const submitSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.recipient_email || !newMessage.subject || !newMessage.body)
      return;

    setSending(true);
    try {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify(newMessage),
      });
      if (res.ok) {
        setIsComposeModalOpen(false);
        setNewMessage({
          recipient_email: "",
          recipient_name: "",
          subject: "",
          body: "",
        });
        fetchMessages();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = messages.filter(
    (m) =>
      (m.subject?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (m.recipient_email?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (m.recipient_name?.toLowerCase() || "").includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="text-brand-green" />
            Messagerie & Factures
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            Envoyez des e-mails ou des factures et suivez leur statut d'envoi.
          </p>
        </div>
        <button
          onClick={() => setIsComposeModalOpen(true)}
          className="px-4 py-2 bg-brand-green text-white font-bold rounded-xl hover:bg-brand-green-light transition-all flex items-center gap-2 shadow-lg shadow-brand-green/20 whitespace-nowrap active:scale-95"
        >
          <Send size={16} />{" "}
          <span className="hidden sm:inline">Nouveau Message</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Rechercher par sujet, destinataire..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green/50 text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500">
            Chargement des messages...
          </div>
        ) : filteredMessages.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-4 sm:p-5 flex items-start gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    msg.status === "sent"
                      ? "bg-brand-green/10 text-brand-green"
                      : msg.status === "failed"
                        ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10"
                        : "bg-amber-50 text-amber-500 dark:bg-amber-500/10",
                  )}
                >
                  {msg.status === "sent" ? (
                    <CheckCircle2 size={20} />
                  ) : msg.status === "failed" ? (
                    <XCircle size={20} />
                  ) : (
                    <Clock size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                        {msg.subject}
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        À :{" "}
                        {msg.recipient_name
                          ? `${msg.recipient_name} <${msg.recipient_email}>`
                          : msg.recipient_email}
                      </p>
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 whitespace-nowrap">
                      {msg.created_at
                        ? format(
                            parseISO(msg.created_at),
                            "dd MMM yyyy, HH:mm",
                            { locale: fr },
                          )
                        : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {msg.body}
                  </p>
                  {msg.attachment_url && (
                    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit text-xs font-bold text-slate-600 dark:text-slate-300">
                      <FileText size={14} className="text-slate-400" /> Pièce
                      jointe incluse
                    </div>
                  )}
                </div>
                <button
                  onClick={() => deleteMessage(msg.id)}
                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  title="Supprimer de l'historique"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center text-slate-500">
            <Mail className="mx-auto h-16 w-16 text-slate-200 dark:text-slate-700 mb-4" />
            <p className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Aucun message
            </p>
            <p className="text-sm">
              Envoyez des factures ou des e-mails et suivez-les ici.
            </p>
          </div>
        )}
      </div>

      {isComposeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center p-4 animate-in fade-in duration-200 items-start overflow-y-auto pt-16 sm:pt-24 pb-24 px-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send size={18} className="text-brand-green" /> Nouveau message
              </h2>
              <button
                onClick={() => setIsComposeModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={submitSendMessage}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-4 overflow-y-auto space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                      Email Destinataire
                    </label>
                    <input
                      type="email"
                      required
                      value={newMessage.recipient_email}
                      onChange={(e) =>
                        setNewMessage({
                          ...newMessage,
                          recipient_email: e.target.value,
                        })
                      }
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all dark:text-white"
                      placeholder="client@entreprise.com"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                      Nom (Optionnel)
                    </label>
                    <input
                      type="text"
                      value={newMessage.recipient_name}
                      onChange={(e) =>
                        setNewMessage({
                          ...newMessage,
                          recipient_name: e.target.value,
                        })
                      }
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all dark:text-white"
                      placeholder="Nom de l'entreprise"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Sujet
                  </label>
                  <input
                    type="text"
                    required
                    value={newMessage.subject}
                    onChange={(e) =>
                      setNewMessage({ ...newMessage, subject: e.target.value })
                    }
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Message
                  </label>
                  <textarea
                    required
                    rows={8}
                    value={newMessage.body}
                    onChange={(e) =>
                      setNewMessage({ ...newMessage, body: e.target.value })
                    }
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all dark:text-white custom-scrollbar resize-none"
                    placeholder="Tapez votre message ici..."
                  />
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsComposeModalOpen(false)}
                  className="px-5 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="px-6 py-2 bg-brand-green text-white font-bold rounded-xl hover:bg-brand-green-light transition-all flex items-center gap-2 shadow-lg shadow-brand-green/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    "Envoi..."
                  ) : (
                    <>
                      Envoyer <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
