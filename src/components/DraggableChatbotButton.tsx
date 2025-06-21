import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { MessageSquare } from 'lucide-react';
import { useChatbotVisibility } from '@/contexts/ChatbotVisibilityContext';

const DraggableChatbotButton: React.FC = () => {
  const { toggleChat } = useChatbotVisibility();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const hasDragged = useRef(false); // New ref to track if a drag occurred
  const dragOffset = useRef({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const STORAGE_KEY = 'chatbot_button_position';

  useEffect(() => {
    // Force a known visible position for debugging
    setPosition({ x: 50, y: 50 });
    // Commenting out local storage load for debugging
    // const savedPosition = localStorage.getItem(STORAGE_KEY);
    // if (savedPosition) {
    //   setPosition(JSON.parse(savedPosition));
    // } else {
    //   setPosition({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
    // }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (buttonRef.current) {
      setIsDragging(true);
      hasDragged.current = false; // Reset drag flag on mouse down
      dragOffset.current = {
        x: e.clientX - buttonRef.current.getBoundingClientRect().left,
        y: e.clientY - buttonRef.current.getBoundingClientRect().top,
      };
      e.preventDefault(); // Prevent default drag behavior
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    // If mouse moves significantly, it's a drag
    if (Math.abs(e.clientX - (position.x + dragOffset.current.x)) > 5 ||
        Math.abs(e.clientY - (position.y + dragOffset.current.y)) > 5) {
      hasDragged.current = true;
    }

    let newX = e.clientX - dragOffset.current.x;
    let newY = e.clientY - dragOffset.current.y;

    // Constrain to viewport
    if (buttonRef.current) {
      const maxX = window.innerWidth - buttonRef.current.offsetWidth;
      const maxY = window.innerHeight - buttonRef.current.offsetHeight;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
    }

    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // Save position to local storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only open chat if no significant drag occurred
    if (!hasDragged.current) {
      toggleChat();
    }
    hasDragged.current = false; // Reset for next interaction
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]); // Re-run effect if dragging state or position changes

  return (
    <>
      <Button
        ref={buttonRef}
        className="fixed z-50 rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 flex items-center justify-center overflow-hidden"
        style={{ left: position.x, top: position.y, cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        size="lg"
      >
        {/* Cute Robot Head SVG */}
        {/* Robot Head SVG - Matching provided image */}
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
          {/* Head (Circular shape) */}
          <circle cx="20" cy="20" r="19.8" fill="#E0E0E0"/> {/* Light gray circle, 99% of viewBox */}
          {/* Eyes */}
          <g className="robot-eyes">
            {/* Eye bases (white) */}
            <circle cx="12" cy="18" r="5" fill="white"/>
            <circle cx="28" cy="18" r="5" fill="white"/>
            {/* Pupils (black) - these will blink */}
            <circle cx="12" cy="18" r="3" fill="black" className="robot-pupil-left"/>
            <circle cx="28" cy="18" r="3" fill="black" className="robot-pupil-right"/>
          </g>
        </svg>
      </Button>
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { transform: scaleY(1); }
          49% { transform: scaleY(1); } /* Hold open */
          50% { transform: scaleY(0.1); } /* Close quickly */
          51% { transform: scaleY(1); } /* Open quickly */
        }
        .robot-pupil-left, .robot-pupil-right {
          animation: blink 4s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
    </>
  );
};

export default DraggableChatbotButton;