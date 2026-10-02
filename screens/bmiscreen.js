/**
 * BMIScreen — vstride (kalkulator IMT/BMI)
 *
 * Props:
 *  - theme            token tema vstride dari App.js (memakai juga `theme.bmi[kategori]`)
 *  - setActiveScreen  fungsi routing; tombol kembali menuju 'home'
 *
 * Setiap hasil hitung yang valid disimpan ke riwayat (utils/storage.addBmiEntry)
 * dan dibaca oleh HomeScreen dan HistoryScreen.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import ScreenHeader from '../components/screenheader';
import { Btn, Card, Field, Segment } from '../components/ui';
import {
  BMI_META,
  BMI_SCALE,
  GENDERS,
  calculateBmi,
  getScaleMarkerPct,
  onlyNumeric,
} from '../utils/bmi';
import { addBmiEntry } from '../utils/storage';

export default function BMIScreen({ theme: t, setActiveScreen }) {
  const s = useMemo(() => createStyles(t), [t]);

  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const goHome = useCallback(() => {
    if (typeof setActiveScreen === 'function') setActiveScreen('home');
  }, [setActiveScreen]);

  const handleCalculate = useCallback(() => {
    Keyboard.dismiss();

    const outcome = calculateBmi({ gender, age, height, weight });

    if (outcome.error) {
      setError(outcome.error);
      setResult(null);
      return;
    }

    const { result: next } = outcome;
    setError('');
    setResult(next);

    // Simpan tanpa memblokir UI. Storage tidak melempar error (lihat utils/storage.js).
    addBmiEntry({
      bmi: Number(next.bmi.toFixed(1)),
      category: next.category,
      bmr: next.bmr,
      age: next.age,
      gender: next.gender,
      height: next.height,
      weight: next.weight,
    });
  }, [gender, age, height, weight]);

  const meta = result ? BMI_META[result.category] : null;
  const categoryColor = result ? t.bmi[result.category] : null;
  const markerPct = result ? getScaleMarkerPct(result.bmi) : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} touchSoundDisabled>
          <ScrollView
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Card theme={t}>
              <Segment
                theme={t}
                label="Jenis kelamin"
                options={GENDERS}
                value={gender}
                onChange={setGender}
              />

              <Field
                theme={t}
                label="Usia"
                value={age}
                placeholder="-"
                suffix="tahun"
                keyboardType="number-pad"
                maxLength={3}
                onChangeText={(v) => setAge(onlyNumeric(v))}
              />

              <View style={s.twoCol}>
                <View style={s.flex}>
                  <Field
                    theme={t}
                    label="Tinggi badan"
                    value={height}
                    placeholder="-"
                    suffix="cm"
                    keyboardType="decimal-pad"
                    maxLength={5}
                    onChangeText={(v) => setHeight(onlyNumeric(v))}
                  />
                </View>
                <View style={s.flex}>
                  <Field
                    theme={t}
                    label="Berat badan"
                    value={weight}
                    placeholder="-"
                    suffix="kg"
                    keyboardType="decimal-pad"
                    maxLength={5}
                    onChangeText={(v) => setWeight(onlyNumeric(v))}
                  />
                </View>
              </View>

              {error ? (
                <Text style={s.errorText} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <View style={s.calcButton}>
                <Btn theme={t} label="Hitung BMI" icon="analytics" onPress={handleCalculate} />
              </View>
            </Card>

            {result && meta ? (
              <>
                <Card theme={t} style={s.resultCard}>
                  <View style={s.bmiTop}>
                    <View>
                      <Text style={s.fieldLabel}>IMT Anda</Text>
                      <Text style={s.bmiValue}>{result.bmi.toFixed(1)}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: categoryColor }]}>
                      <Text style={s.badgeText}>{meta.label}</Text>
                    </View>
                  </View>

                  <View style={s.scaleWrap}>
                    <View style={s.scaleBar}>
                      {BMI_SCALE.map((seg) => (
                        <View key={seg.key} style={{ flex: seg.flex, backgroundColor: t.bmi[seg.key] }} />
                      ))}
                    </View>
                    <View style={[s.scaleMarker, { left: `${markerPct}%` }]} />
                  </View>

                  <Text style={s.metaLine}>
                    Estimasi kebutuhan energi dasar (BMR): {result.bmr} kkal/hari
                  </Text>
                  {result.age < 18 ? (
                    <Text style={s.metaLine}>
                      Kategori ini berlaku untuk usia 18 tahun ke atas. Untuk anak dan remaja, gunakan kurva
                      pertumbuhan.
                    </Text>
                  ) : null}
                </Card>

                <View
                  style={[
                    s.adviceBox,
                    { borderColor: categoryColor, backgroundColor: `${categoryColor}1A` },
                  ]}
                >
                  <View style={s.adviceHead}>
                    <Ionicons name={meta.icon} size={20} color={categoryColor} />
                    <Text style={s.adviceTitle}>{meta.title}</Text>
                  </View>
                  {meta.tips.map((tip) => (
                    <View key={tip} style={s.tipRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={categoryColor}
                        style={s.tipIcon}
                      />
                      <Text style={s.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>

                <Text style={s.disclaimer}>
                  Informasi bersifat umum dan bukan pengganti konsultasi tenaga medis.
                </Text>
              </>
            ) : null}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (t) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    flex: { flex: 1 },
    content: { padding: 16, paddingBottom: 48 },

    twoCol: { flexDirection: 'row', gap: 12 },
    errorText: { color: t.danger, fontSize: 13, fontWeight: '600', marginTop: 2 },
    calcButton: { marginTop: 16 },

    resultCard: { marginTop: 16 },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: t.sub, marginBottom: 6 },
    bmiTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bmiValue: { fontSize: 44, fontWeight: '800', letterSpacing: -1, color: t.text },
    badge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
    badgeText: { color: t.onPrimary, fontSize: 13, fontWeight: '700' },

    scaleWrap: { marginTop: 18, marginBottom: 14, justifyContent: 'center' },
    scaleBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
    scaleMarker: {
      position: 'absolute',
      width: 16,
      height: 16,
      borderRadius: 8,
      marginLeft: -8,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.text,
    },
    metaLine: { fontSize: 12, color: t.sub, marginTop: 4, lineHeight: 18 },

    adviceBox: { marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 0 },
    adviceHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    adviceTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: t.text },
    tipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    tipIcon: { marginTop: 2 },
    tipText: { flex: 1, fontSize: 14, lineHeight: 20, color: t.text },
    disclaimer: { fontSize: 11, color: t.sub, textAlign: 'center', marginTop: 16 },
  });