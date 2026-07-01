// Input (design-component-library.md §6). One text field, four states. The fill is ONE role (surfaceAlt);
// the states recolour the BORDER only (that is why no semantic `border` fork is needed, §3.2): focus ->
// focusRing (1.5px) + a faint accentMuted halo, error -> error + a meta/error line below, disabled ->
// opacity 0.4 + fill surface. The label is caption/textMuted uppercase; the placeholder resolves to
// textMuted (§13 drift 3, replacing the hardcoded hexes). SearchRow is the §6 variant the location
// credential form uses: a flexed field beside a primary Search button. Every colour is a §12 `input` role.
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor, roleRadius } from './theme';
import { Button } from './Button';

export interface InputProps {
  value: string;
  onChangeText?: (text: string) => void;
  label?: string;
  placeholder?: string;
  /** A hint below the field (meta/textMuted); multi-line uses the new type.lineHeight (§3.4). */
  hint?: string;
  /** An error message; recolours the border to `error` and shows the line below (§6). */
  error?: string | null;
  disabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: 'done' | 'search' | 'next' | 'go';
  onSubmitEditing?: () => void;
  /** Force the focus visual (specimens / tests); when omitted, real focus events drive it. */
  focused?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** Lets SearchRow flex the field without a wrapper style leak. */
  flex?: boolean;
}

export function Input({
  value,
  onChangeText,
  label,
  placeholder,
  hint,
  error,
  disabled = false,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  returnKeyType,
  onSubmitEditing,
  focused,
  accessibilityLabel,
  testID,
  flex = false,
}: InputProps) {
  const { theme } = useUnistyles();
  const t = theme.input;
  const [internalFocus, setInternalFocus] = useState(false);
  const isFocused = (focused ?? internalFocus) && !disabled;
  const hasError = !!error;
  const radius = roleRadius(theme, t.radius);

  // The states recolour the border only; the fill stays one role (surface when disabled, else surfaceAlt).
  const borderRole = hasError ? t.borderError : isFocused ? t.borderFocus : t.border;
  const borderColor = roleColor(theme, borderRole) as string;
  const fillRole = disabled ? t.fillDisabled : t.fill;

  return (
    <View style={[flex && { flexGrow: 1, flexShrink: 1 }, disabled && { opacity: t.disabledOpacity }]}>
      {label ? (
        <Text style={{ ...theme.type.caption, color: theme.colors.textMuted, textTransform: 'uppercase', marginBottom: theme.spacing(1) }}>
          {label}
        </Text>
      ) : null}

      <View>
        {/* §6 focus halo: the one accent at low alpha (accentMuted, §3.3) sitting just outside the edge. */}
        {isFocused ? (
          <View
            pointerEvents="none"
            testID="input-focus-halo"
            style={{ position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: radius + 2, borderWidth: 3, borderColor: theme.colors.accentMuted }}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={roleColor(theme, t.placeholder)}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setInternalFocus(true)}
          onBlur={() => setInternalFocus(false)}
          accessibilityLabel={accessibilityLabel ?? label}
          testID={testID}
          style={{
            height: t.height,
            paddingHorizontal: t.paddingX,
            borderRadius: radius,
            backgroundColor: roleColor(theme, fillRole),
            borderColor,
            borderWidth: isFocused ? t.borderWidthFocus : t.borderWidth,
            color: theme.colors.text,
            fontSize: 15,
          }}
        />
      </View>

      {hasError ? (
        <Text testID="input-error" style={{ ...theme.type.meta, color: theme.colors.error, marginTop: theme.spacing(1) }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ ...theme.type.meta, color: theme.colors.textMuted, marginTop: theme.spacing(1) }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export interface SearchRowProps extends Omit<InputProps, 'flex'> {
  onSearch?: () => void;
  searchLabel?: string;
  searching?: boolean;
  searchDisabled?: boolean;
}

/** §6 search row: a flexed field beside a primary Search button (the location credential form uses this;
 *  the results render in an elevation.raised RowGroup of ListRows, composed by the caller). */
export function SearchRow({
  onSearch,
  searchLabel = 'Search',
  searching = false,
  searchDisabled = false,
  ...inputProps
}: SearchRowProps) {
  const { theme } = useUnistyles();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing(3) }}>
      <Input {...inputProps} flex returnKeyType="search" onSubmitEditing={onSearch} />
      <Button
        label={searchLabel}
        variant="primary"
        onPress={onSearch}
        loading={searching}
        disabled={searchDisabled}
        testID="search-row-submit"
      />
    </View>
  );
}
