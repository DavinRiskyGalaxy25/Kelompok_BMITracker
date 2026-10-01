/**
 * vstride — komponen UI bersama (dipindah dari App.js lama tanpa perubahan tampilan).
 *
 * Semua komponen menerima prop `theme` dari App.js dan tidak memakai warna hardcoded.
 * Style dibuat sekali per objek theme (WeakMap), bukan per instance komponen.
 */
import React, { forwardRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/* --------------------------------- Shared --------------------------------- */

/** Gaya kartu vstride: radius 16, tanpa border, shadow lembut (hanya di mode terang). */
export const getCardStyle = (theme) => ({
  backgroundColor: theme.card,
  borderRadius: 16,
  padding: 16,
  borderWidth: 0,
  borderColor: theme.border,
  ...(theme.isDark
    ? {}
    : {
        shadowColor: theme.shadow,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }),
});

const styleCache = new WeakMap();

const getStyles = (theme) => {
  let styles = styleCache.get(theme);
  if (!styles) {
    styles = createStyles(theme);
    styleCache.set(theme, styles);
  }
  return styles;
};

/* --------------------------------- Card ---------------------------------- */

export const Card = ({ theme, style, children }) => (
  <View style={[getStyles(theme).card, style]}>{children}</View>
);

/* ------------------------------ SectionTitle ------------------------------ */

export const SectionTitle = ({ theme, icon, title }) => {
  const s = getStyles(theme);
  return (
    <View style={s.sectionTitleRow}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
};

/* ---------------------------------- Chip ---------------------------------- */

export const Chip = ({ theme, label, icon, active, disabled, onPress }) => {
  const s = getStyles(theme);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active), disabled: Boolean(disabled) }}
      style={[s.chip, active && s.chipActive, disabled && !active && s.dimmed]}
    >
      {icon ? <Ionicons name={icon} size={16} color={active ? theme.onPrimary : theme.sub} /> : null}
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
};

/* ----------------------------------- Btn ---------------------------------- */

/**
 * variant: 'primary' | 'danger' | 'outline' | 'soft'
 * `soft` = latar t.input (untuk aksi sekunder yang tetap perlu terlihat sebagai tombol).
 */
export const Btn = ({ theme, label, icon, onPress, disabled, loading, variant = 'primary', grow }) => {
  const s = getStyles(theme);

  const bg =
    variant === 'primary' ? theme.primary
    : variant === 'danger' ? theme.danger
    : variant === 'soft' ? theme.input
    : 'transparent';
  const fg = variant === 'outline' || variant === 'soft' ? theme.text : theme.onPrimary;
  const inactive = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      style={[s.btn, { backgroundColor: bg }, grow && s.grow, disabled && s.dimmed]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={fg} />
      ) : null}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
};

/* ---------------------------------- Stat ---------------------------------- */

export const Stat = ({ theme, icon, label, value, unit }) => {
  const s = getStyles(theme);
  return (
    <View style={s.stat}>
      <View style={s.statHead}>
        <Ionicons name={icon} size={14} color={theme.primary} />
        <Text style={s.statLabel}>{label}</Text>
      </View>
      <Text style={s.statValue}>
        {value}
        {unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
};

/* -------------------------------- Segment --------------------------------- */

/**
 * Pilihan tunggal berbentuk segmented control (mis. jenis kelamin).
 * options: [{ key, label, icon? }]
 */
export const Segment = ({ theme, options, value, onChange, label }) => {
  const s = getStyles(theme);
  return (
    <View>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <View style={s.segment} accessibilityRole="radiogroup">
        {options.map((option) => {
          const active = value === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              activeOpacity={0.85}
              onPress={() => onChange(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[s.segmentItem, active && s.segmentItemActive]}
            >
              {option.icon ? (
                <Ionicons name={option.icon} size={16} color={active ? theme.onPrimary : theme.sub} />
              ) : null}
              <Text style={[s.segmentText, active && s.segmentTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

/* ---------------------------------- Field --------------------------------- */

/**
 * Input berlabel. Props tambahan selain di bawah diteruskan ke TextInput
 * (keyboardType, maxLength, returnKeyType, onSubmitEditing, autoComplete, dst).
 *
 *  - icon   : ikon Ionicons di kiri input
 *  - suffix : teks satuan di kanan (cm, kg, tahun)
 *  - secure : input kata sandi dengan tombol tampil/sembunyi
 */
export const Field = forwardRef(function Field(
  { theme, label, value, onChangeText, placeholder, icon, suffix, secure, editable = true, ...rest },
  ref
) {
  const s = getStyles(theme);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={s.field}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <View style={[s.inputWrap, !editable && s.dimmed]}>
        {icon ? <Ionicons name={icon} size={18} color={theme.sub} style={s.inputIcon} /> : null}
        <TextInput
          ref={ref}
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.sub}
          editable={editable}
          secureTextEntry={Boolean(secure) && hidden}
          accessibilityLabel={label}
          {...rest}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setHidden((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Tampilkan kata sandi' : 'Sembunyikan kata sandi'}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={theme.sub} />
          </TouchableOpacity>
        ) : null}
        {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
});

/* --------------------------------- Styles --------------------------------- */

const createStyles = (t) =>
  StyleSheet.create({
    card: getCardStyle(t),
    dimmed: { opacity: 0.4 },
    grow: { flex: 1 },

    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: t.text },

    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
      backgroundColor: t.card, borderWidth: 0, borderColor: t.border,
    },
    chipActive: { backgroundColor: t.primary, borderColor: t.primary },
    chipText: { fontSize: 14, fontWeight: '600', color: t.sub },
    chipTextActive: { color: t.onPrimary },

    btn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 0,
    },
    btnText: { fontSize: 14, fontWeight: '700' },

    stat: { width: '50%' },
    statHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    statLabel: { fontSize: 12, color: t.sub },
    statValue: { fontSize: 20, fontWeight: '700', color: t.text },
    statUnit: { fontSize: 12, fontWeight: '500', color: t.sub },

    segment: { flexDirection: 'row', backgroundColor: t.input, borderRadius: 12, padding: 4, marginBottom: 14 },
    segmentItem: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 10, borderRadius: 9,
    },
    segmentItemActive: { backgroundColor: t.primary },
    segmentText: { fontSize: 14, fontWeight: '600', color: t.sub },
    segmentTextActive: { color: t.onPrimary },

    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: t.sub, marginBottom: 6 },
    inputWrap: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: t.input,
      borderRadius: 12, paddingHorizontal: 14, borderWidth: 0, borderColor: t.border,
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, paddingVertical: 12, fontSize: 16, color: t.text },
    suffix: { fontSize: 13, color: t.sub, marginLeft: 8 },
  });