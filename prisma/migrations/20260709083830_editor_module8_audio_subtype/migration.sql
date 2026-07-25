-- CreateEnum
CREATE TYPE "EditorAudioSubtype" AS ENUM ('VOICE', 'MUSIC', 'SFX');

-- AlterTable
ALTER TABLE "editor_tracks" ADD COLUMN     "audioSubtype" "EditorAudioSubtype";
