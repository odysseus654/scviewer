export type Listener = (...args: any[]) => void;

export interface EventEmitter<EventName extends string> {
    on(event: EventName, listener: Listener): () => void;
    removeListener(event: EventName, listener: Listener): void;
    removeAllListeners(): void;
    emit(event: EventName, ...args: any[]): void;
    once(event: EventName, listener: Listener): () => void;
}

interface EventEmitterConstructor {
    new <EventName extends string>() : EventEmitter<EventName>;
}

export declare var EventEmitter : EventEmitterConstructor;