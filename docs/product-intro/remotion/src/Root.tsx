import React from "react";
import { Composition } from "remotion";
import { ShadowingMasterIntro } from "./Intro";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ShadowingMasterIntro"
      component={ShadowingMasterIntro}
      durationInFrames={1245}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
  );
};
