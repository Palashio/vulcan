declare module 'play-sound' {
    interface Player {
        play(filename: string, callback?: (err?: Error) => void): any;
    }

    interface PlaySound {
        (opts?: { player?: string }): Player;
    }

    const playSound: PlaySound;
    export default playSound;
} 