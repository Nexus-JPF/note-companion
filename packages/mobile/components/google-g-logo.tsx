import { Image, type ImageStyle, type StyleProp } from "react-native";

type GoogleGLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Official multicolor Google "G" (Sign in with Google branding). */
export function GoogleGLogo({ size = 24, style }: GoogleGLogoProps) {
  return (
    <Image
      source={require("@/assets/images/google-g.png")}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
