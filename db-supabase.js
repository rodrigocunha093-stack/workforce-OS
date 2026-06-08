const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://megimevuyjaevilogepe.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_xFO7xF4gyy3VVQFLfGos-w_X2j9eBlv';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function getUser(email) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('DB Error on getUser:', error.message);
      return null;
    }
    return data || null;
  } catch (error) {
    console.error('DB Error on getUser:', error.message);
    return null;
  }
}

async function getUserById(id) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('DB Error on getUserById:', error.message);
      return null;
    }
    return data || null;
  } catch (error) {
    console.error('DB Error on getUserById:', error.message);
    return null;
  }
}

async function createUser(user) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        passwordSalt: user.passwordSalt,
        inviteCode: user.inviteCode || null
      }])
      .select();

    if (error) {
      console.error('DB Error on createUser:', error.code, error.message, { email: user.email });
      return false;
    }
    console.log('User created:', user.email);
    return true;
  } catch (error) {
    console.error('DB Error on createUser:', error.message);
    return false;
  }
}

async function saveSession(token, userId, expiresAt) {
  try {
    const { error } = await supabase
      .from('sessions')
      .upsert([{
        token,
        userId,
        expiresAt: new Date(expiresAt).toISOString()
      }]);

    if (error) {
      console.error('DB Error on saveSession:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('DB Error on saveSession:', error.message);
    return false;
  }
}

async function getSession(token) {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('token', token)
      .gt('expiresAt', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('DB Error on getSession:', error.message);
      return null;
    }
    return data || null;
  } catch (error) {
    console.error('DB Error on getSession:', error.message);
    return null;
  }
}

async function deleteSession(token) {
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('token', token);

    if (error) {
      console.error('DB Error on deleteSession:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('DB Error on deleteSession:', error.message);
    return false;
  }
}

async function saveClientData(userId, data) {
  try {
    const { error } = await supabase
      .from('clients')
      .upsert([{
        userId,
        data,
        updatedAt: new Date().toISOString()
      }]);

    if (error) {
      console.error('DB Error on saveClientData:', error.message, { userId });
      return false;
    }
    return true;
  } catch (error) {
    console.error('DB Error on saveClientData:', error.message);
    return false;
  }
}

async function getClientData(userId) {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('data')
      .eq('userId', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('DB Error on getClientData:', error.message);
      return null;
    }
    return data ? data.data : null;
  } catch (error) {
    console.error('DB Error on getClientData:', error.message);
    return null;
  }
}

async function auditLog(userId, action, detail) {
  try {
    const { error } = await supabase
      .from('audit')
      .insert([{
        userId,
        action,
        detail
      }]);

    if (error) {
      console.error('DB Error on auditLog:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('DB Error on auditLog:', error.message);
    return false;
  }
}

module.exports = {
  getUser,
  getUserById,
  createUser,
  saveSession,
  getSession,
  deleteSession,
  saveClientData,
  getClientData,
  auditLog
};
