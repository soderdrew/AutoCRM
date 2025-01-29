import { useState, useEffect, useRef } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../../ui/sheet";
import { Send } from "lucide-react";
import { getAIResponse, formatChatHistory } from "../../../services/ai-agent";
import { BaseMessage } from "@langchain/core/messages";
import useAuth from "../../../hooks/use-auth";

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface VolunteerTicketChatProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper function to format text with markdown-style syntax
const formatTextContent = (text: string) => {
  // Handle bold text
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Handle italics
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');

  return text;
};

// Helper function to format message content
const formatMessageContent = (content: string) => {
  // Split content into sections by "==="
  const sections = content.split('===').filter(Boolean);
  
  if (sections.length <= 1) {
    // If no sections, just split by newlines and handle bullet points
    return content.split('\n').map((line, i) => {
      const trimmed = line.trim();
      
      // Handle section-like headers with ###
      if (trimmed.startsWith('###')) {
        return (
          <div key={i} className="font-bold text-sm text-foreground mt-3 mb-1">
            {trimmed.replace(/^###\s*/, '')}
          </div>
        );
      }
      
      // Handle bullet points
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        return (
          <div key={i} className="ml-4 text-sm py-0.5 text-foreground flex items-start">
            <span className="mr-2">•</span>
            <span dangerouslySetInnerHTML={{ __html: formatTextContent(trimmed.substring(1).trim()) }} />
          </div>
        );
      }
      
      // Handle empty lines
      if (!trimmed) {
        return <div key={i} className="h-2" />;
      }

      // Handle regular text
      return (
        <div key={i} className="text-sm py-0.5 text-foreground" 
             dangerouslySetInnerHTML={{ __html: formatTextContent(trimmed) }} />
      );
    });
  }

  return sections.map((section, index) => {
    const [title, ...content] = section.trim().split('\n');
    return (
      <div key={index} className="mb-4">
        {title && (
          <div className="font-bold text-foreground mb-2 text-base">
            {title.trim()}
          </div>
        )}
        <div className="space-y-0.5">
          {content.map((line, i) => {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
              return (
                <div key={i} className="ml-4 text-sm py-0.5 text-foreground flex items-start">
                  <span className="mr-2">•</span>
                  <span dangerouslySetInnerHTML={{ __html: formatTextContent(trimmed.substring(1).trim()) }} />
                </div>
              );
            }

            if (!trimmed) {
              return <div key={i} className="h-2" />;
            }

            return (
              <div key={i} className="text-sm py-0.5 text-foreground" 
                   dangerouslySetInnerHTML={{ __html: formatTextContent(trimmed) }} />
            );
          })}
        </div>
      </div>
    );
  });
};

export function VolunteerTicketChat({ isOpen, onClose }: VolunteerTicketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  };

  // Scroll when messages change or when AI starts/stops typing
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Add welcome message when chat is opened for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: 'welcome',
        content: "Hi! I'm your AI Volunteer Assistant. I can help you:\n\n" +
                "- Show your current volunteer assignments\n" +
                "- Find available opportunities you can sign up for\n" +
                "- Sign you up for new opportunities\n\n" +
                "Try asking:\n\n" +
                "- 'What events am I doing?'\n" +
                "- 'What opportunities are available?'\n" +
                "- 'Sign me up for [opportunity name]'\n\n" +
                "How can I help you today?",
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      // Format chat history for the AI
      const chatHistory = formatChatHistory(messages) as BaseMessage[];
      
      // Get AI response with user context
      const aiResponse = await getAIResponse(inputMessage, chatHistory, user.id);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse.content,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I encountered an error. Please try again.",
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[600px] sm:w-[800px] lg:w-[1000px] h-full flex flex-col p-0 max-w-[90vw]">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>AI Volunteer Assistant</SheetTitle>
          <SheetDescription>
            Chat with me to find and sign up for volunteer opportunities that match your interests.
          </SheetDescription>
        </SheetHeader>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-100 text-foreground ml-4'
                      : 'bg-muted mr-4'
                  }`}
                >
                  <div className="space-y-2">
                    {formatMessageContent(message.content)}
                  </div>
                  <span className="text-xs opacity-70 mt-2 block">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 mr-4">
                  <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-foreground/25 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 rounded-full bg-foreground/25 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 rounded-full bg-foreground/25 animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about volunteer opportunities..."
              className="flex-1"
            />
            <Button type="submit" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
