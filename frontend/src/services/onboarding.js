import { supabase } from '../lib/supabase'

export const onboardingAPI = {
  getProfile: async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    if (error) throw error
    return { data }
  },
  
  submitOnboarding: async (data) => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data: result, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        name: user.user_metadata?.name || user.email,
        ...data,
        onboarding_completed: true
      })
      .select()
      .single()
    
    if (error) throw error
    return { data: { message: 'Onboarding completed successfully', profile: result } }
  },
  
  getOnboardingStatus: async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()
    
    if (error) throw error
    return { data: { onboarding_completed: data?.onboarding_completed || false } }
  },

  updateProfile: async (data) => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    console.log('Updating profile for user:', user.id)
    console.log('Update data:', data)
    
    const { data: result, error } = await supabase
      .from('profiles')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single()
    
    console.log('Update result:', result)
    console.log('Update error:', error)
    
    if (error) throw error
    return { data: { message: 'Profile updated successfully', profile: result } }
  },
}
