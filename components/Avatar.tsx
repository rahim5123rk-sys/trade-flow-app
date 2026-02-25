import React from 'react';
import { Image, ImageStyle, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from './../constants/theme';
import { getInitials } from './../src/utils/formatting';

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  style?: ViewStyle;
}

const SIZES = {
  sm: { container: 32, text: 14, radius: 10 },
  md: { container: 40, text: 16, radius: 12 },
  lg: { container: 50, text: 20, radius: 16 },
  xl: { container: 64, text: 26, radius: 20 },
};

export function Avatar({
  name,
  imageUrl,
  size = 'md',
  color = Colors.primary,
  style,
}: AvatarProps) {
  const dims = SIZES[size];
  const initials = getInitials(name);

  if (imageUrl) {
    const imageStyle: ImageStyle = {
      width: dims.container,
      height: dims.container,
      borderRadius: dims.container / 2,
    };

    return (
      <Image
        source={{ uri: imageUrl }}
        style={imageStyle}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: dims.container,
          height: dims.container,
          borderRadius: dims.container / 2,
          backgroundColor: `${color}15`,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: dims.text,
            color,
          },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
  },
});