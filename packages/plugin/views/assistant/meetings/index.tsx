import React from "react";
import { StyledContainer } from "../../../components/ui/utils";
import { tw } from "../../../lib/utils";
import FileOrganizer from "../../../index";
import { MeetingRecorder } from "./meeting-recorder";
import { RecentMeetings } from "./recent-meetings";
import { ScreenpipeMeetings } from "./screenpipe-meetings";

interface MeetingsTabProps {
  plugin: FileOrganizer;
}

export const MeetingsTab: React.FC<MeetingsTabProps> = ({ plugin }) => {
  return (
    <StyledContainer>
      <div className={tw("flex flex-col h-full w-full")}>
        <MeetingRecorder plugin={plugin} />
        <RecentMeetings plugin={plugin} />
        {plugin.settings.enableScreenpipe && (
          <ScreenpipeMeetings plugin={plugin} />
        )}
      </div>
    </StyledContainer>
  );
};

