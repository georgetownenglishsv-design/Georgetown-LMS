import React, { useState } from 'react';
import { Icon } from './Icon';
import { DailyQuiz } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface DailyQuizModalProps {
    quiz: DailyQuiz;
    onClose: () => void;
}

export const DailyQuizModal: React.FC<DailyQuizModalProps> = ({ quiz, onClose }) => {
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleOptionSelect = (index: number) => {
        if (isSubmitted) return;
        setSelectedOption(index);
    };

    const handleSubmit = () => {
        if (selectedOption === null) return;
        setIsSubmitted(true);
    };

    const isCorrect = selectedOption === quiz.correctAnswer;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="size-12 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Icon name="quiz" className="text-2xl" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-xl">Daily Quiz</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{quiz.category || 'Práctica Diaria'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="size-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-colors">
                        <Icon name="close" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    {/* Question */}
                    <div className="mb-8">
                        <h4 className="text-2xl md:text-3xl font-black text-slate-800 leading-tight">
                            {quiz.question}
                        </h4>
                    </div>

                    {/* Options */}
                    <div className="space-y-3 mb-8">
                        {quiz.options?.map((option, index) => {
                            const isSelected = selectedOption === index;
                            const showCorrect = isSubmitted && index === quiz.correctAnswer;
                            const showWrong = isSubmitted && isSelected && !isCorrect;

                            let buttonClass = "w-full p-5 rounded-2xl border-2 text-left font-bold text-lg transition-all flex items-center justify-between group ";
                            
                            if (!isSubmitted) {
                                buttonClass += isSelected 
                                    ? "border-orange-500 bg-orange-50 text-orange-700 shadow-md" 
                                    : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50/50";
                            } else {
                                if (showCorrect) {
                                    buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md";
                                } else if (showWrong) {
                                    buttonClass += "border-red-500 bg-red-50 text-red-700 shadow-md";
                                } else {
                                    buttonClass += "border-slate-100 bg-slate-50 text-slate-400 opacity-50";
                                }
                            }

                            return (
                                <button 
                                    key={index}
                                    onClick={() => handleOptionSelect(index)}
                                    disabled={isSubmitted}
                                    className={buttonClass}
                                >
                                    <span className="flex-1">{option}</span>
                                    
                                    {/* Status Icon */}
                                    <div className={`size-6 rounded-full flex items-center justify-center shrink-0 ml-4 transition-all ${
                                        !isSubmitted && isSelected ? "bg-orange-500 text-white" :
                                        !isSubmitted ? "bg-slate-100 text-transparent group-hover:bg-orange-200" :
                                        showCorrect ? "bg-emerald-500 text-white" :
                                        showWrong ? "bg-red-500 text-white" :
                                        "bg-transparent text-transparent"
                                    }`}>
                                        <Icon name={
                                            showCorrect ? "check" : 
                                            showWrong ? "close" : 
                                            "check"
                                        } className="text-sm" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Explanation (Shows after submit) */}
                    <AnimatePresence>
                        {isSubmitted && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
                                className="overflow-hidden"
                            >
                                <div className={`p-6 rounded-3xl border-2 ${isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`size-10 rounded-full flex items-center justify-center ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                            <Icon name={isCorrect ? "sentiment_very_satisfied" : "sentiment_dissatisfied"} className="text-xl" />
                                        </div>
                                        <h5 className={`font-black text-xl ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {isCorrect ? '¡Excelente!' : 'Casi lo logras'}
                                        </h5>
                                    </div>
                                    <p className="text-slate-700 font-medium leading-relaxed">
                                        {quiz.explanation}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    {!isSubmitted ? (
                        <button 
                            onClick={handleSubmit}
                            disabled={selectedOption === null}
                            className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all ${
                                selectedOption !== null 
                                    ? 'bg-slate-900 text-white shadow-xl hover:bg-slate-800 active:scale-[0.98]' 
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            Comprobar Respuesta
                        </button>
                    ) : (
                        <button 
                            onClick={onClose}
                            className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2 bg-slate-900 text-white shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all"
                        >
                            <Icon name="check" /> Continuar
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
