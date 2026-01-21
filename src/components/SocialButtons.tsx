import React from 'react';
import { Text, Pressable, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hapticFeedback } from '../utils/hapticFeedback';
import { toastManager } from '../utils/toastManager';
import Svg, { Path, G } from 'react-native-svg';

// Discord SVG Icon
function DiscordIcon({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 640 512" fill="#ffffff">
      <Path d="M524.531 69.836a1.5 1.5 0 0 0-.764-.7A485.065 485.065 0 0 0 404.081 32.03a1.816 1.816 0 0 0-1.923.91 337.461 337.461 0 0 0-14.9 30.6 447.848 447.848 0 0 0-134.426 0 309.541 309.541 0 0 0-15.135-30.6 1.89 1.89 0 0 0-1.924-.91 483.689 483.689 0 0 0-119.688 37.107 1.712 1.712 0 0 0-.788.676C39.068 183.651 18.186 294.69 28.43 404.354a2.016 2.016 0 0 0 .765 1.375 487.666 487.666 0 0 0 146.825 74.189a1.9 1.9 0 0 0 2.063-.676A348.2 348.2 0 0 0 208.12 430.4a1.86 1.86 0 0 0-1.019-2.588 321.173 321.173 0 0 1-45.868-21.853 1.885 1.885 0 0 1-.185-3.126 251.047 251.047 0 0 0 9.109-7.137 1.819 1.819 0 0 1 1.9-.256c96.229 43.917 200.41 43.917 295.5 0a1.812 1.812 0 0 1 1.924.233 234.533 234.533 0 0 0 9.132 7.16 1.884 1.884 0 0 1-.162 3.126 301.407 301.407 0 0 1-45.89 21.83 1.875 1.875 0 0 0-1 2.611 391.055 391.055 0 0 0 30.014 48.815 1.864 1.864 0 0 0 2.063.7A486.048 486.048 0 0 0 610.7 405.729a1.882 1.882 0 0 0 .765-1.352c12.264-126.783-20.532-236.912-86.934-334.541zM222.491 337.58c-28.972 0-52.844-26.587-52.844-59.239s23.409-59.241 52.844-59.241c29.665 0 53.306 26.82 52.843 59.239 0 32.654-23.41 59.241-52.843 59.241zm195.38 0c-28.971 0-52.843-26.587-52.843-59.239s23.409-59.241 52.843-59.241c29.667 0 53.307 26.820 52.844 59.239 0 32.654-23.177 59.241-52.844 59.241z" />
    </Svg>
  );
}

// Instagram SVG Icon
function InstagramIcon({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G>
        <Path
          d="M12 8.75C10.205 8.75 8.75 10.205 8.75 12C8.75 13.795 10.205 15.25 12 15.25C13.795 15.25 15.25 13.795 15.25 12C15.25 10.205 13.795 8.75 12 8.75Z"
          fill="#ffffff"
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6.77 3.082C7.94 2.986 8.337 2.973 12 2.973C15.663 2.973 16.06 2.987 17.23 3.082C18.398 3.177 19.183 3.376 19.861 3.661C20.565 3.954 21.154 4.341 21.732 4.919C22.31 5.497 22.696 6.086 22.99 6.79C23.275 7.468 23.474 8.253 23.569 9.421C23.665 10.591 23.678 10.988 23.678 14.651C23.678 18.314 23.664 18.711 23.569 19.881C23.474 21.049 23.275 21.834 22.99 22.512C22.696 23.216 22.309 23.805 21.732 24.383C21.154 24.961 20.565 25.347 19.861 25.641C19.183 25.926 18.398 26.125 17.23 26.22C16.06 26.316 15.663 26.329 12 26.329C8.337 26.329 7.94 26.315 6.77 26.22C5.602 26.125 4.817 25.926 4.139 25.641C3.435 25.347 2.846 24.96 2.268 24.383C1.69 23.805 1.304 23.216 1.01 22.512C0.725 21.834 0.526 21.049 0.431 19.881C0.335 18.711 0.322 18.314 0.322 14.651C0.322 10.988 0.336 10.591 0.431 9.421C0.526 8.253 0.725 7.468 1.01 6.79C1.304 6.086 1.691 5.497 2.268 4.919C2.846 4.341 3.435 3.955 4.139 3.661C4.817 3.376 5.602 3.177 6.77 3.082ZM17.128 5.003C15.971 4.909 15.602 4.897 12 4.897C8.398 4.897 8.029 4.909 6.872 5.003C5.802 5.091 5.22 5.282 4.828 5.441C4.31 5.651 3.94 5.899 3.551 6.288C3.162 6.677 2.914 7.047 2.704 7.565C2.545 7.957 2.354 8.539 2.266 9.609C2.172 10.766 2.16 11.135 2.16 14.737C2.16 18.339 2.172 18.708 2.266 19.865C2.354 20.935 2.545 21.517 2.704 21.909C2.914 22.427 3.162 22.797 3.551 23.186C3.94 23.575 4.31 23.823 4.828 24.033C5.22 24.192 5.802 24.383 6.872 24.471C8.029 24.565 8.397 24.577 12 24.577C15.603 24.577 15.971 24.565 17.128 24.471C18.198 24.383 18.78 24.192 19.172 24.033C19.69 23.823 20.06 23.575 20.449 23.186C20.838 22.797 21.086 22.427 21.296 21.909C21.455 21.517 21.646 20.935 21.734 19.865C21.828 18.708 21.84 18.339 21.84 14.737C21.84 11.135 21.828 10.766 21.734 9.609C21.646 8.539 21.455 7.957 21.296 7.565C21.086 7.047 20.838 6.677 20.449 6.288C20.06 5.899 19.69 5.651 19.172 5.441C18.78 5.282 18.198 5.091 17.128 5.003Z"
          fill="#ffffff"
        />
        <Path
          d="M12 17.838C9.461 17.838 7.412 15.789 7.412 13.25C7.412 10.711 9.461 8.662 12 8.662C14.539 8.662 16.588 10.711 16.588 13.25C16.588 15.789 14.539 17.838 12 17.838ZM12 6.75C8.406 6.75 5.5 9.656 5.5 13.25C5.5 16.844 8.406 19.75 12 19.75C15.594 19.75 18.5 16.844 18.5 13.25C18.5 9.656 15.594 6.75 12 6.75Z"
          fill="#ffffff"
        />
        <Path
          d="M19.5 7.5C19.5 8.328 18.828 9 18 9C17.172 9 16.5 8.328 16.5 7.5C16.5 6.672 17.172 6 18 6C18.828 6 19.5 6.672 19.5 7.5Z"
          fill="#ffffff"
        />
      </G>
    </Svg>
  );
}

// LinkedIn SVG Icon
function LinkedInIcon({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        fill="#ffffff"
        d="M12.225 12.225h-1.778V9.44c0-.664-.012-1.519-.925-1.519-.926 0-1.068.724-1.068 1.47v2.834H6.676V6.498h1.707v.783h.024c.348-.594.996-.95 1.684-.925 1.802 0 2.135 1.185 2.135 2.728l-.001 3.14zM4.67 5.715a1.037 1.037 0 01-1.032-1.031c0-.566.466-1.032 1.032-1.032.566 0 1.031.466 1.032 1.032 0 .566-.466 1.032-1.032 1.032zm.889 6.51h-1.78V6.498h1.78v5.727zM13.11 2H2.885A.88.88 0 002 2.866v10.268a.88.88 0 00.885.866h10.226a.882.882 0 00.889-.866V2.865a.88.88 0 00-.889-.864z"
      />
    </Svg>
  );
}

interface SocialButtonProps {
  url: string;
  label: string;
  icon: React.ReactNode;
  gradientColors: readonly [string, string, ...string[]];
  shadowColor: string;
}

function SocialButton({ url, label, icon, gradientColors, shadowColor }: SocialButtonProps) {
  const handlePress = async () => {
    hapticFeedback.medium();
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        toastManager.error(`Unable to open ${label} link`);
      }
    } catch (error) {
      console.error(`Error opening ${label}:`, error);
      toastManager.error(`Failed to open ${label}`);
    }
  };

  return (
    <Pressable onPress={handlePress} style={{ opacity: 1 }}>
      {({ pressed }) => (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 12,
            gap: 12,
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          }}
        >
          {icon}
          <Text className="text-white font-semibold text-base flex-1">{label}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

export function DiscordButton({ url = 'https://discord.gg/your-server' }: { url?: string }) {
  return (
    <SocialButton
      url={url}
      label="Follow on Discord"
      icon={<DiscordIcon size={24} />}
      gradientColors={['#5865F2', '#4752C4']}
      shadowColor="#5865F2"
    />
  );
}

export function InstagramButton({ url = 'https://instagram.com/your-profile' }: { url?: string }) {
  return (
    <SocialButton
      url={url}
      label="Follow on Instagram"
      icon={<InstagramIcon size={24} />}
      gradientColors={['#833AB4', '#C13584', '#E1306C', '#FD1D1D', '#F56040', '#FFDC80']}
      shadowColor="#E1306C"
    />
  );
}

export function LinkedInButton({ url = 'https://linkedin.com/company/your-company' }: { url?: string }) {
  return (
    <SocialButton
      url={url}
      label="Follow on LinkedIn"
      icon={<LinkedInIcon size={24} />}
      gradientColors={['#0A66C2', '#004182']}
      shadowColor="#0A66C2"
    />
  );
}
